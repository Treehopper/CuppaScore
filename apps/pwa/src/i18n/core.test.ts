import { describe, expect, it } from 'vitest';
import { detectLocale, pseudoize, Translator } from './core';
import de from './de.json';
import en from './en.json';
import es from './es.json';
import itMsgs from './it.json';

const tr = new Translator({ de, en, es, it: itMsgs });

describe('i18n core', () => {
  it('detects the first supported device language', () => {
    expect(detectLocale(['fr-FR', 'de-AT', 'en'])).toBe('de');
    expect(detectLocale(['es-MX'])).toBe('es');
    expect(detectLocale(['fr', 'ja'])).toBe('en');
    expect(detectLocale([])).toBe('en');
  });

  it('formats ICU plurals per locale', () => {
    expect(tr.t('de', 'common.cups', { count: 1 })).toBe('1 Tasse');
    expect(tr.t('de', 'common.cups', { count: 3 })).toBe('3 Tassen');
    expect(tr.t('es', 'common.cups', { count: 3 })).toBe('3 tazas');
    expect(tr.t('it', 'meal.sweet')).toBe('Dolce');
  });

  it('README §11 vocabulary', () => {
    expect(tr.t('de', 'brew.moka')).toBe('Espressokocher');
    expect(tr.t('it', 'brew.frenchPress')).toBe('Caffettiera a stantuffo');
    expect(tr.t('es', 'drink.batch')).toBe('Café de filtro');
    expect(tr.t('it', 'source.cafe')).toBe('Bar');
    expect(tr.t('es', 'swipe.less')).toBe('Menos de esto');
    expect(tr.t('de', 'flavour.nutty')).toBe('Nussig');
  });

  it('falls back to the key and pseudo-localises', () => {
    expect(tr.t('de', 'nope.missing')).toBe('nope.missing');
    expect(tr.t('en-XA', 'common.save')).toBe('⟦Sávé~⟧');
    expect(pseudoize('Save')).toMatch(/^⟦.*⟧$/);
  });
});
