# CupLog dev sandbox — based on the Claude Code reference devcontainer
# (https://github.com/anthropics/claude-code/tree/main/.devcontainer), extended with
# pnpm, Playwright browsers + system deps, and a locked-down egress firewall.
#
# Bookworm is pinned because Playwright's `--with-deps` officially targets it.
FROM node:25-bookworm

ARG TZ=Europe/Berlin
ENV TZ="$TZ"

ARG CLAUDE_CODE_VERSION=latest
ARG PNPM_VERSION=12.14.0
ARG PLAYWRIGHT_VERSION=1.64.1
ARG PLAYWRIGHT_MCP_VERSION=0.0.83
ARG GIT_DELTA_VERSION=0.18.2
ARG ZSH_IN_DOCKER_VERSION=1.2.0

# Basic dev tools + iptables/ipset for the firewall
RUN apt-get update && apt-get install -y --no-install-recommends \
  less \
  git \
  procps \
  sudo \
  fzf \
  zsh \
  man-db \
  unzip \
  gnupg2 \
  gh \
  iptables \
  ipset \
  iproute2 \
  dnsutils \
  aggregate \
  jq \
  nano \
  vim \
  ripgrep \
  && apt-get clean && rm -rf /var/lib/apt/lists/*

# Ensure default node user has access to /usr/local/share
RUN mkdir -p /usr/local/share/npm-global && \
  chown -R node:node /usr/local/share

ARG USERNAME=node

# Persist bash history.
RUN mkdir /commandhistory \
  && touch /commandhistory/.bash_history \
  && chown -R $USERNAME /commandhistory

ENV DEVCONTAINER=true

# Workspace, Claude config, pnpm store and Playwright browser dirs
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN mkdir -p /workspace /home/node/.claude /home/node/.local/share/pnpm/store /ms-playwright && \
  chown -R node:node /workspace /home/node/.claude /home/node/.local /ms-playwright

WORKDIR /workspace

RUN ARCH=$(dpkg --print-architecture) && \
  wget "https://github.com/dandavison/delta/releases/download/${GIT_DELTA_VERSION}/git-delta_${GIT_DELTA_VERSION}_${ARCH}.deb" && \
  dpkg -i "git-delta_${GIT_DELTA_VERSION}_${ARCH}.deb" && \
  rm "git-delta_${GIT_DELTA_VERSION}_${ARCH}.deb"

# Playwright OS-level dependencies (needs root). Browsers themselves are installed
# below as the node user so the project can reuse them without network access.
RUN npx -y playwright@${PLAYWRIGHT_VERSION} install-deps chromium firefox webkit \
  && apt-get clean && rm -rf /var/lib/apt/lists/*

# Set up non-root user
USER node

ENV NPM_CONFIG_PREFIX=/usr/local/share/npm-global
ENV PATH=$PATH:/usr/local/share/npm-global/bin
ENV PNPM_HOME=/home/node/.local/share/pnpm
ENV npm_config_store_dir=/home/node/.local/share/pnpm/store
ENV PATH=$PNPM_HOME:$PATH
ENV SHELL=/bin/zsh
ENV EDITOR=nano
ENV VISUAL=nano

# Default powerline10k theme
RUN sh -c "$(wget -O- https://github.com/deluan/zsh-in-docker/releases/download/v${ZSH_IN_DOCKER_VERSION}/zsh-in-docker.sh)" -- \
  -p git \
  -p fzf \
  -a "source /usr/share/doc/fzf/examples/key-bindings.zsh" \
  -a "source /usr/share/doc/fzf/examples/completion.zsh" \
  -a "export PROMPT_COMMAND='history -a' && export HISTFILE=/commandhistory/.bash_history" \
  -x

# Claude Code, pnpm, Playwright CLI + MCP server
RUN npm install -g \
  @anthropic-ai/claude-code@${CLAUDE_CODE_VERSION} \
  pnpm@${PNPM_VERSION} \
  playwright@${PLAYWRIGHT_VERSION} \
  @playwright/mcp@${PLAYWRIGHT_MCP_VERSION}

# Browsers for @playwright/test (the app should pin the same version, see CLAUDE.md)
RUN playwright install chromium firefox webkit && \
  cd "$(npm root -g)/@playwright/mcp" && npx --no-install playwright install chromium

RUN git config --global --add safe.directory /workspace && \
  git config --global core.pager delta && \
  git config --global init.defaultBranch develop

# Firewall: script + allowlist are root-owned and baked into the image, so code running
# as `node` (i.e. Claude) cannot widen the allowlist by editing files in /workspace.
USER root
COPY init-firewall.sh post-start.sh /usr/local/bin/
COPY allowed-domains.txt /etc/claude-firewall/allowed-domains.txt
# Debian's /etc/profile resets PATH for login shells; restore the tool paths
RUN printf 'export PATH="/home/node/.local/share/pnpm:$PATH:/usr/local/share/npm-global/bin"\n' > /etc/profile.d/sandbox-path.sh
RUN chmod 0755 /usr/local/bin/init-firewall.sh /usr/local/bin/post-start.sh && \
  chmod 0644 /etc/claude-firewall/allowed-domains.txt && \
  echo "node ALL=(root) NOPASSWD: /usr/local/bin/init-firewall.sh" > /etc/sudoers.d/node-firewall && \
  chmod 0440 /etc/sudoers.d/node-firewall
USER node
