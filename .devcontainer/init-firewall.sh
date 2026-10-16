#!/bin/bash
# Default-deny egress firewall for the CupLog Claude sandbox.
# Based on https://github.com/anthropics/claude-code/blob/main/.devcontainer/init-firewall.sh
#
# Usage (as root / via sudo):
#   init-firewall.sh                 full setup: flush, build allowlist, default DROP, verify
#   init-firewall.sh --refresh       re-resolve allowlisted domains and add new IPs (no flush)
#   init-firewall.sh --refresh-loop  run --refresh every $FIREWALL_REFRESH_SECONDS (default 600)
#
# CDN-backed hosts (npm, svelte.dev, Playwright CDN, ...) rotate IPs; the refresh loop
# keeps long autonomous sessions from slowly losing access.
set -euo pipefail
IFS=$'\n\t'

ALLOWLIST=/etc/claude-firewall/allowed-domains.txt
IPSET=allowed-domains

log() { echo "[firewall] $*"; }

# Reads the allowlist: strips comments/blank lines. A trailing "!" marks a domain as
# required (setup aborts if it does not resolve); all others only warn.
read_domains() {
    sed -e 's/#.*//' -e 's/[[:space:]]//g' "$ALLOWLIST" | grep -v '^$' || true
}

add_domain() {
    local entry=$1 domain required=0 ips ip
    domain=${entry%!}
    [[ "$entry" == *! ]] && required=1

    ips=$(dig +noall +answer +time=3 +tries=2 A "$domain" | awk '$4 == "A" {print $5}' || true)
    if [ -z "$ips" ]; then
        if [ "$required" = 1 ]; then
            log "ERROR: failed to resolve required domain $domain"
            return 1
        fi
        log "WARN: could not resolve $domain (skipped)"
        return 0
    fi
    while read -r ip; do
        if [[ ! "$ip" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
            log "ERROR: invalid IP from DNS for $domain: $ip"
            return 1
        fi
        ipset add -exist "$IPSET" "$ip"
    done <<< "$ips"
    log "allowed $domain ($(echo "$ips" | wc -l | tr -d ' ') IPs)"
}

add_github_ranges() {
    local gh_ranges cidr
    log "fetching GitHub IP ranges..."
    gh_ranges=$(curl -s --connect-timeout 10 https://api.github.com/meta)
    if [ -z "$gh_ranges" ] || ! echo "$gh_ranges" | jq -e '.web and .api and .git and .pages' >/dev/null; then
        log "ERROR: failed to fetch GitHub meta"
        return 1
    fi
    # web/api/git: github.com + API + git over https; pages: *.github.io docs + deploy previews
    while read -r cidr; do
        if [[ ! "$cidr" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}/[0-9]{1,2}$ ]]; then
            log "ERROR: invalid CIDR range from GitHub meta: $cidr"
            return 1
        fi
        ipset add -exist "$IPSET" "$cidr"
    done < <(echo "$gh_ranges" | jq -r '(.web + .api + .git + .pages)[] | select(contains(":") | not)' | aggregate -q)
}

add_all_domains() {
    local d
    while read -r d; do
        add_domain "$d"
    done < <(read_domains)
}

refresh() {
    ipset list -n "$IPSET" >/dev/null 2>&1 || { log "ERROR: ipset $IPSET missing; run full setup first"; return 1; }
    add_all_domains
    add_github_ranges || log "WARN: GitHub range refresh failed (keeping existing ranges)"
}

case "${1:-}" in
    --refresh)
        refresh
        exit 0
        ;;
    --refresh-loop)
        while true; do
            sleep "${FIREWALL_REFRESH_SECONDS:-600}"
            refresh >/dev/null 2>&1 || true
        done
        ;;
    "") ;;
    *)
        echo "unknown option: $1" >&2
        exit 2
        ;;
esac

# --- Full setup -------------------------------------------------------------

# 1. Extract Docker DNS info BEFORE any flushing
DOCKER_DNS_RULES=$(iptables-save -t nat | grep "127\.0\.0\.11" || true)

iptables -F
iptables -X
iptables -t nat -F
iptables -t nat -X
iptables -t mangle -F
iptables -t mangle -X
ipset destroy "$IPSET" 2>/dev/null || true

# 2. Selectively restore ONLY internal Docker DNS resolution
if [ -n "$DOCKER_DNS_RULES" ]; then
    log "restoring Docker DNS rules..."
    iptables -t nat -N DOCKER_OUTPUT 2>/dev/null || true
    iptables -t nat -N DOCKER_POSTROUTING 2>/dev/null || true
    echo "$DOCKER_DNS_RULES" | xargs -L 1 iptables -t nat
else
    log "no Docker DNS rules to restore"
fi

# DNS, SSH (git over ssh), localhost (Vite dev server, Playwright, MCP stdio)
iptables -A OUTPUT -p udp --dport 53 -j ACCEPT
iptables -A INPUT -p udp --sport 53 -j ACCEPT
iptables -A OUTPUT -p tcp --dport 22 -j ACCEPT
iptables -A INPUT -p tcp --sport 22 -m state --state ESTABLISHED -j ACCEPT
iptables -A INPUT -i lo -j ACCEPT
iptables -A OUTPUT -o lo -j ACCEPT

ipset create "$IPSET" hash:net

add_github_ranges
add_all_domains

# Host network (port forwarding of 5173/4173 to the host, VS Code server)
HOST_IP=$(ip route | grep default | cut -d" " -f3)
if [ -z "$HOST_IP" ]; then
    log "ERROR: failed to detect host IP"
    exit 1
fi
HOST_NETWORK=$(echo "$HOST_IP" | sed "s/\.[0-9]*$/.0\/24/")
log "host network detected as: $HOST_NETWORK"
iptables -A INPUT -s "$HOST_NETWORK" -j ACCEPT
iptables -A OUTPUT -d "$HOST_NETWORK" -j ACCEPT

iptables -P INPUT DROP
iptables -P FORWARD DROP
iptables -P OUTPUT DROP

iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
iptables -A OUTPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
iptables -A OUTPUT -m set --match-set "$IPSET" dst -j ACCEPT
iptables -A OUTPUT -j REJECT --reject-with icmp-admin-prohibited

# IPv6 is not allowlisted at all: block it so it can't be used as a bypass.
if command -v ip6tables >/dev/null 2>&1 && ip6tables -L >/dev/null 2>&1; then
    ip6tables -F || true
    ip6tables -A INPUT -i lo -j ACCEPT
    ip6tables -A OUTPUT -o lo -j ACCEPT
    ip6tables -P INPUT DROP
    ip6tables -P FORWARD DROP
    ip6tables -P OUTPUT DROP
    log "IPv6 egress blocked"
fi

log "configuration complete, verifying..."
if curl --connect-timeout 5 https://example.com >/dev/null 2>&1; then
    log "ERROR: verification failed - was able to reach https://example.com"
    exit 1
fi
log "OK - example.com blocked"

for url in https://api.github.com/zen https://registry.npmjs.org/ https://svelte.dev/llms.txt https://api.anthropic.com; do
    # Any HTTP response (even 4xx) proves the connection is allowed
    if ! curl -s -o /dev/null --connect-timeout 5 "$url"; then
        log "ERROR: verification failed - unable to reach $url"
        exit 1
    fi
    log "OK - $url reachable"
done
