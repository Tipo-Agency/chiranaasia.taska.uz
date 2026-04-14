/**
 * HTML редактора документов: любая запись в DOM (innerHTML) — только через setDocEditorHtml;
 * чтение для API/экспорта — takeDocEditorHtml / sanitizeDocHtml (DOMPurify).
 */
import DOMPurify from 'dompurify';

/** Теги, которые даёт contenteditable / execCommand и типичная разметка статей. */
const ALLOWED_TAGS = [
  'p',
  'br',
  'b',
  'i',
  'u',
  's',
  'strong',
  'em',
  'h1',
  'h2',
  'h3',
  'h4',
  'ul',
  'ol',
  'li',
  'a',
  'img',
  'blockquote',
  'code',
  'pre',
  'hr',
  'div',
  'span',
];

const ALLOWED_ATTR = ['href', 'src', 'alt', 'target', 'rel'];

/**
 * HTML документа для редактора и API: только безопасная разметка, без script/on* и т.п.
 */
export function sanitizeDocHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    ALLOW_UNKNOWN_PROTOCOLS: false,
  });
}

/**
 * Единственная точка присвоения innerHTML в редакторе документов (после DOMPurify).
 */
export function setDocEditorHtml(element: HTMLElement, dirty: string): void {
  element.innerHTML = sanitizeDocHtml(dirty);
}

/**
 * Снимок содержимого редактора для сохранения / сравнения — всегда санитизирован.
 */
export function takeDocEditorHtml(element: HTMLElement): string {
  return sanitizeDocHtml(element.innerHTML);
}

/** Текст в разметку HTML (title, h1 при экспорте) — без интерпретации как HTML. */
export function escapeHtmlText(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
