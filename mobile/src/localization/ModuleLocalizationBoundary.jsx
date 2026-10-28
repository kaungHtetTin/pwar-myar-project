import React, { useEffect, useRef } from 'react';
import { useLocale } from './LocaleContext';
import { translateModuleText } from './moduleText';
import { ModuleLocalizationContext } from './ModuleLocalizationContext';

const TRANSLATED_ATTRIBUTES = ['placeholder', 'title', 'aria-label'];
const textSources = new WeakMap();
const attributeSources = new WeakMap();

function translateTextNode(node, language, messages, patterns) {
  if (!node?.parentElement || node.parentElement.closest('[data-no-localize],script,style,textarea,code,pre')) return;
  const current = node.nodeValue || '';
  let state = textSources.get(node);
  if (!state || current !== state.rendered) state = { source: current, rendered: current };
  const rendered = translateModuleText(state.source, language, messages, patterns);
  textSources.set(node, { source: state.source, rendered });
  if (current !== rendered) node.nodeValue = rendered;
}

function translateAttribute(element, attribute, language, messages, patterns) {
  if (!element?.hasAttribute?.(attribute) || element.closest('[data-no-localize]')) return;
  const current = element.getAttribute(attribute) || '';
  let states = attributeSources.get(element);
  if (!states) {
    states = new Map();
    attributeSources.set(element, states);
  }
  let state = states.get(attribute);
  if (!state || current !== state.rendered) state = { source: current, rendered: current };
  const rendered = translateModuleText(state.source, language, messages, patterns);
  states.set(attribute, { source: state.source, rendered });
  if (current !== rendered) element.setAttribute(attribute, rendered);
}

function localizeTree(root, language, messages, patterns) {
  if (!root) return;
  if (root.nodeType === Node.TEXT_NODE) {
    translateTextNode(root, language, messages, patterns);
    return;
  }
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  TRANSLATED_ATTRIBUTES.forEach((attribute) => translateAttribute(root, attribute, language, messages, patterns));
  root.querySelectorAll('*').forEach((element) => TRANSLATED_ATTRIBUTES.forEach((attribute) => translateAttribute(element, attribute, language, messages, patterns)));
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    translateTextNode(node, language, messages, patterns);
    node = walker.nextNode();
  }
}

export function ModuleLocalizationBoundary({ messages, patterns = [], children }) {
  const { language } = useLocale();
  const rootRef = useRef(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    localizeTree(root, language, messages, patterns);
    const observer = new MutationObserver((records) => records.forEach((record) => {
      if (record.type === 'characterData') translateTextNode(record.target, language, messages, patterns);
      else if (record.type === 'attributes') translateAttribute(record.target, record.attributeName, language, messages, patterns);
      else record.addedNodes.forEach((node) => localizeTree(node, language, messages, patterns));
    }));
    observer.observe(root, { attributes: true, attributeFilter: TRANSLATED_ATTRIBUTES, characterData: true, childList: true, subtree: true });
    return () => observer.disconnect();
  }, [language, messages, patterns]);

  return <ModuleLocalizationContext.Provider value={{ messages, patterns }}><div ref={rootRef} style={{ display: 'contents' }}>{children}</div></ModuleLocalizationContext.Provider>;
}
