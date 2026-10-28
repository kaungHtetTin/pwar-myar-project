import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { request } from '../api';
import { getCurrentLanguage, setCurrentLanguage, translateText } from '../translations';

const LanguageContext = createContext({
  language: 'en',
  translate: (value) => value,
  setLanguage: () => {},
});

const TRANSLATED_ATTRIBUTES = ['placeholder', 'title', 'aria-label'];
const textSources = new WeakMap();
const attributeSources = new WeakMap();

function translateTextNode(node, language) {
  if (!node?.parentElement || node.parentElement.closest('[data-no-localize],script,style,textarea,code,pre')) return;
  const current = node.nodeValue || '';
  let state = textSources.get(node);
  if (!state || current !== state.rendered) {
    state = { source: current, rendered: current };
  }
  const rendered = translateText(state.source, language);
  textSources.set(node, { source: state.source, rendered });
  if (current !== rendered) node.nodeValue = rendered;
}

function translateAttribute(element, attribute, language) {
  if (!element?.hasAttribute?.(attribute) || element.closest('[data-no-localize]')) return;
  const current = element.getAttribute(attribute) || '';
  let states = attributeSources.get(element);
  if (!states) {
    states = new Map();
    attributeSources.set(element, states);
  }
  let state = states.get(attribute);
  if (!state || current !== state.rendered) {
    state = { source: current, rendered: current };
  }
  const rendered = translateText(state.source, language);
  states.set(attribute, { source: state.source, rendered });
  if (current !== rendered) element.setAttribute(attribute, rendered);
}

function localizeElement(element, language) {
  TRANSLATED_ATTRIBUTES.forEach((attribute) => translateAttribute(element, attribute, language));
}

function localizeTree(root, language) {
  if (!root) return;
  if (root.nodeType === Node.TEXT_NODE) {
    translateTextNode(root, language);
    return;
  }
  if (root.nodeType !== Node.ELEMENT_NODE) return;

  localizeElement(root, language);
  root.querySelectorAll('*').forEach((element) => localizeElement(element, language));

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    translateTextNode(node, language);
    node = walker.nextNode();
  }
}

function LocalizationBoundary({ language, children }) {
  const rootRef = useRef(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    localizeTree(root, language);
    const observer = new MutationObserver((records) => {
      records.forEach((record) => {
        if (record.type === 'characterData') {
          translateTextNode(record.target, language);
        } else if (record.type === 'attributes') {
          translateAttribute(record.target, record.attributeName, language);
        } else {
          record.addedNodes.forEach((node) => localizeTree(node, language));
        }
      });
    });
    observer.observe(root, {
      attributes: true,
      attributeFilter: TRANSLATED_ATTRIBUTES,
      characterData: true,
      childList: true,
      subtree: true,
    });
    return () => observer.disconnect();
  }, [language]);

  return <div ref={rootRef} className="localization-root">{children}</div>;
}

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(
    () => window.localStorage.getItem('mkpos.language') || getCurrentLanguage(),
  );

  useEffect(() => {
    let cancelled = false;

    async function loadLanguage() {
      try {
        const settings = await request('/settings');
        if (!cancelled) setLanguage(settings.language === 'my' ? 'my' : 'en');
      } catch {
        // The stored preference keeps the UI usable while the backend starts.
      }
    }

    loadLanguage();
    function handleDataChange(event) {
      const resources = event.detail?.resources || [];
      if (resources.includes('*') || resources.includes('settings')) loadLanguage();
    }
    window.addEventListener('mkpos:data-change', handleDataChange);
    return () => {
      cancelled = true;
      window.removeEventListener('mkpos:data-change', handleDataChange);
    };
  }, []);

  useEffect(() => {
    setCurrentLanguage(language);
    window.localStorage.setItem('mkpos.language', language);
  }, [language]);

  const value = useMemo(() => ({
    language,
    translate: (value) => translateText(value, language),
    setLanguage,
  }), [language]);

  return (
    <LanguageContext.Provider value={value}>
      <LocalizationBoundary language={language}>
        {children}
      </LocalizationBoundary>
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
