import { useAiPageLink } from '../ai/useAiPageLink';
import { BrandImage } from '../platformBranding';
import { BusinessTimezoneSettings } from './BusinessTimezoneSettings';
import React, { useMemo, useRef, useState } from 'react';
import {
  Barcode,
  CircleCheck,
  Clock3,
  CreditCard,
  Database,
  Download,
  Eye,
  Info,
  KeyRound,
  Languages,
  LockKeyhole,
  Plus,
  Printer,
  ReceiptText,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Store,
  Tags,
  Trash2,
  Upload,
  UserRound,
} from 'lucide-react';
import packageInfo from '../../package.json';
import { request, requestDownload } from '../api';
import { BRAND_LOGO } from '../assets';
import { actionLabel } from '../utils';
import { Field, LoadingState, Modal } from '../components/common';
import { useScreenNotifications } from '../components/notifications';
import { getTranslator } from '../translations';
import { emitDataChange, useDataRefresh } from '../dataEvents';
import { useLatestEffect } from '../hooks/useLatestEffect';
import { useConfirmation } from '../components/confirmations';
import { printReceiptText, receiptLayoutClassNames, printResultMessage } from '../printing';
import { useLanguage } from '../components/LanguageProvider';
import { sampleReceiptPayload } from '../sampleReceipt';
import { PrinterInput } from '../components/PrinterInput';
import { PrinterSettings } from '../components/PrinterSettings';
import { deviceLayout, withDeviceLayout, sharedSettingsPayload, simplePrinterConfig } from '../printerSettings';
import { usePrinting } from '../hooks/usePrinting';
import { settingsTabsForRole } from '../settingsAccess';
import { BARCODE_LABEL_FORMATS, normalizeBarcodeSettings } from '../barcodeSettings';
import { renderBarcodeSvg } from '../barcodePrinting';
import { usePlatformContacts } from '../platformContacts';

const BARCODE_PREVIEW_PRODUCT = Object.freeze({ name: 'Sample Product', barcode: '2008934580979' });

function BarcodeLivePreview({ settings }) {
  const layout = normalizeBarcodeSettings(settings);
  const width = Math.min(340, Math.max(150, layout.labelWidth * 4));
  return (
    <section className="barcode-live-preview" aria-label="Barcode sticker live preview">
      <div className="barcode-live-preview-heading"><strong>Live preview</strong><small>Single product sample</small></div>
      <div className="barcode-live-preview-stage">
        <article className="barcode-live-preview-label" style={{ width, aspectRatio: `${layout.labelWidth} / ${layout.labelHeight}` }}>
          {layout.barcode_show_name === '1' && <strong>{BARCODE_PREVIEW_PRODUCT.name}</strong>}
          <span className="barcode-live-preview-bars" aria-hidden="true" dangerouslySetInnerHTML={{ __html: renderBarcodeSvg(BARCODE_PREVIEW_PRODUCT.barcode) }} />
          {layout.barcode_show_value === '1' && <code>{BARCODE_PREVIEW_PRODUCT.barcode}</code>}
        </article>
      </div>
      <small>{layout.labelWidth} × {layout.labelHeight} mm sticker</small>
    </section>
  );
}

const tabs = [
  { id: 'account', icon: UserRound, subtitle: 'Profile and sign-in password' },
  { id: 'shop', icon: Store, subtitle: 'Business identity' },
  { id: 'timezone', icon: Clock3, subtitle: 'Business dates and operating hours' },
  { id: 'receipt', icon: ReceiptText, subtitle: 'Receipt content and layout' },
  { id: 'barcode', icon: Barcode, subtitle: 'Label paper and content' },
  { id: 'printer', icon: Printer, subtitle: 'Printer connection and paper' },
  { id: 'payments', icon: CreditCard, subtitle: 'Accepted payment methods' },
  { id: 'prices', icon: Tags, subtitle: 'Product selling price types' },
  { id: 'security', icon: ShieldCheck, subtitle: 'Protected actions' },
  { id: 'data', icon: Database, subtitle: 'Backup and restore' },
  { id: 'language', icon: Languages, subtitle: 'Display language' },
  { id: 'about', icon: Info, subtitle: 'Application information' },
];
function defaultSettings() {
  return {
    shop_name: 'PwarMyar Shop',
    shop_title: '',
    shop_address: '',
    shop_phone: '',
    currency: 'Ks',
    payment_methods: 'Cash,Wallet Pay,Banking Pay,KPay,Wave Pay,Credit',
    receipt_footer: 'Thank you',
    receipt_logo_data_url: '',
    receipt_show_customer: '1',
    receipt_show_payment_method: '1',
    receipt_show_price_type: '1',
    receipt_paper_size: '80mm',
    receipt_header_alignment: 'center',
    receipt_margin_left: 3,
    receipt_margin_right: 3,
    receipt_header_font_size: 11,
    receipt_body_font_size: 8.2,
    receipt_line_height: 1.45,
    printer_name: '',
    barcode_label_format: 'sheet_a4_3x8',
    barcode_page_width_mm: 210,
    barcode_page_height_mm: 297,
    barcode_label_width_mm: 63.5,
    barcode_label_height_mm: 33.9,
    barcode_margin_x_mm: 7.25,
    barcode_margin_y_mm: 12.9,
    barcode_gap_x_mm: 2.5,
    barcode_gap_y_mm: 0,
    barcode_show_name: '1',
    barcode_show_value: '1',
    language: 'en',
    admin_pin: '',
    admin_pin_set: '0',
  };
}

function settingsPayload(settings, patch = {}) {
  const merged = { ...defaultSettings(), ...settings, ...patch };
  const enabled = (value) => String(value).trim().toLowerCase() === '1' || value === true;
  const numeric = (value, fallback) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  return {
    shop_name: String(merged.shop_name || 'PwarMyar Shop').trim() || 'PwarMyar Shop',
    shop_title: String(merged.shop_title || ''),
    shop_address: String(merged.shop_address || ''),
    shop_phone: String(merged.shop_phone || ''),
    currency: String(merged.currency || 'Ks').trim() || 'Ks',
    payment_methods: String(merged.payment_methods || 'Cash'),
    receipt_footer: String(merged.receipt_footer || ''),
    receipt_show_customer: enabled(merged.receipt_show_customer) ? '1' : '0',
    receipt_show_payment_method: enabled(merged.receipt_show_payment_method) ? '1' : '0',
    receipt_show_price_type: enabled(merged.receipt_show_price_type) ? '1' : '0',
    receipt_paper_size: ['50mm', '58mm', '80mm', '85mm', 'a5', 'a4'].includes(merged.receipt_paper_size) ? merged.receipt_paper_size : '80mm',
    receipt_header_alignment: ['left', 'center', 'right'].includes(merged.receipt_header_alignment) ? merged.receipt_header_alignment : 'center',
    receipt_margin_left: numeric(merged.receipt_margin_left, 3),
    receipt_margin_right: numeric(merged.receipt_margin_right, 3),
    receipt_header_font_size: numeric(merged.receipt_header_font_size, 11),
    receipt_body_font_size: numeric(merged.receipt_body_font_size, 8.2),
    receipt_line_height: numeric(merged.receipt_line_height, 1.45),
    printer_name: String(merged.printer_name || ''),
    barcode_label_format: BARCODE_LABEL_FORMATS[merged.barcode_label_format] ? merged.barcode_label_format : 'sheet_a4_3x8',
    barcode_page_width_mm: numeric(merged.barcode_page_width_mm, 210),
    barcode_page_height_mm: numeric(merged.barcode_page_height_mm, 297),
    barcode_label_width_mm: numeric(merged.barcode_label_width_mm, 63.5),
    barcode_label_height_mm: numeric(merged.barcode_label_height_mm, 33.9),
    barcode_margin_x_mm: numeric(merged.barcode_margin_x_mm, 7.25),
    barcode_margin_y_mm: numeric(merged.barcode_margin_y_mm, 12.9),
    barcode_gap_x_mm: numeric(merged.barcode_gap_x_mm, 2.5),
    barcode_gap_y_mm: numeric(merged.barcode_gap_y_mm, 0),
    barcode_show_name: enabled(merged.barcode_show_name) ? '1' : '0',
    barcode_show_value: enabled(merged.barcode_show_value) ? '1' : '0',
    language: ['en', 'my'].includes(merged.language) ? merged.language : 'en',
    admin_pin: String(merged.admin_pin || ''),
  };
}

function receiptPreviewSettings(settings) {
  return {
    ...settingsPayload(settings),
    receipt_logo_data_url: String(settings.receipt_logo_data_url || ''),
  };
}

function splitPaymentMethods(value) {
  const rows = String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
  return rows.length ? rows : ['Cash'];
}

function paymentMethodRows(value) {
  return splitPaymentMethods(value).map((name, index) => ({
    id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`,
    name,
  }));
}

function editablePriceTypeRows(items, usage = {}, rules = []) {
  const rulesByName = Object.fromEntries((rules || []).map((rule) => [String(rule.name || '').toLocaleLowerCase(), rule]));
  return (items || []).map((name, index) => ({
    id: `price-type-${index}-${name}`,
    originalName: name,
    name,
    productCount: Number(usage[name] || 0),
    pricingMode: rulesByName[name.toLocaleLowerCase()]?.pricing_mode === 'automatic' ? 'automatic' : 'manual',
    markupPercent: Number(rulesByName[name.toLocaleLowerCase()]?.markup_percent || 0),
    rounding: Number(rulesByName[name.toLocaleLowerCase()]?.rounding || 1),
    minimumProfit: Number(rulesByName[name.toLocaleLowerCase()]?.minimum_profit || 0),
    applyToExisting: false,
  }));
}

function priceTypeErrorMessage(error) {
  if (/method not allowed|not found/i.test(String(error?.message || ''))) {
    return 'Price settings are not active in the running backend. Close and restart the PwarMyar backend, then try again.';
  }
  return error?.message || 'The price type action failed.';
}

async function saveBlobWithPicker(blob, filename) {
  if (window.showSaveFilePicker) {
    const handle = await window.showSaveFilePicker({
      suggestedName: filename,
      types: [{ description: 'PwarMyar Laravel backup', accept: { 'application/gzip': ['.mkpos-backup'] } }],
    });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return;
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function SettingsScreen() {
  const dirtySettingKeys = useRef(new Set());
  const platformContacts = usePlatformContacts();
  const restoreFileInputRef = useRef(null);
  const logoFileInputRef = useRef(null);
  const [activeTab, setActiveTab] = useState('shop');
  const [settings, setSettings] = useState(defaultSettings());
  const [account, setAccount] = useState({ name: '', email: '', role: 'owner', current_password: '', password: '', password_confirmation: '' });
  const [accountBusy, setAccountBusy] = useState(false);
  const [paymentRows, setPaymentRows] = useState(paymentMethodRows(defaultSettings().payment_methods));
  const [priceTypeRows, setPriceTypeRows] = useState([]);
  const [newPriceType, setNewPriceType] = useState('');
  const [priceTypeBusy, setPriceTypeBusy] = useState('');
  const [dataStatus, setDataStatus] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [restoreFile, setRestoreFile] = useState(null);
  const [restoreConfirm, setRestoreConfirm] = useState('');
  const [restorePin, setRestorePin] = useState('');
  const [resetConfirm, setResetConfirm] = useState('');
  const [resetPin, setResetPin] = useState('');
  const [printers, setPrinters] = useState([]);
  const [printerConfig, setPrinterConfig] = useState(null);
  const printing = usePrinting();
  const [receiptPreview, setReceiptPreview] = useState({
    text: '',
    html: '',
    paper_size: '80mm',
    layout: {},
  });
  const [previewLoading, setPreviewLoading] = useState(false);
  const [receiptPreviewOpen, setReceiptPreviewOpen] = useState(false);
  const [testPrinting, setTestPrinting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const [dataBusy, setDataBusy] = useState(false);
  const { setMessage, setError } = useScreenNotifications();
  const { setLanguage } = useLanguage();
  const confirmAction = useConfirmation();

  const t = useMemo(() => getTranslator(settings.language), [settings.language]);
  const visibleTabs = settingsTabsForRole(tabs, account.role);
  const activeTabInfo = visibleTabs.find((tab) => tab.id === activeTab) || visibleTabs[0];
  useAiPageLink('settings', target => { if (target.tab) setActiveTab(target.tab); }, !loading);
  const trialRestricted = subscription?.is_valid && subscription?.access_type === 'trial';

  function openBilling() {
    window.dispatchEvent(new CustomEvent('mkpos:navigate-billing'));
  }

  async function loadSettings(background = false) {
    if (!background) setLoading(true);
    setError('');
    try {
      let loaded = { ...defaultSettings(), ...(await request('/settings')) };
      const localPrinter = await window.mkposDesktop?.getPrinterPreference?.();
      if (localPrinter != null) loaded.printer_name = localPrinter;
      if (window.mkposDesktop?.getPrinterConfig) {
        const config = await window.mkposDesktop.getPrinterConfig();
        setPrinterConfig(config);
        loaded = withDeviceLayout(loaded, config);
      }
      setSettings(current => background ? { ...loaded, ...Object.fromEntries([...dirtySettingKeys.current].map(key => [key, current[key]])) } : loaded);
      if (!background) { dirtySettingKeys.current.clear(); setPaymentRows(paymentMethodRows(loaded.payment_methods)); }
    } catch (err) {
      setError(`Cannot load settings. ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function loadAccount() {
    try {
      const session = await request('/auth/me');
      setAccount((current) => ({
        ...current,
        name: session.user?.name || '',
        email: session.user?.email || '',
        role: session.user?.role || 'owner',
      }));
      setSubscription(session.subscription || null);
      return session;
    } catch (err) {
      setError(`Cannot load account profile. ${err.message}`);
    }
  }

  async function loadDataState() {
    try {
      setDataStatus(await request('/data/status'));
    } catch (err) {
      setError(`Cannot load database status. ${err.message}`);
    }
  }

  async function loadPriceTypes() {
    try {
      const payload = await request('/price-types');
      setPriceTypeRows(editablePriceTypeRows(payload.items, payload.usage, payload.rules));
    } catch (err) {
      setError(priceTypeErrorMessage(err));
    }
  }

  async function loadPrinters() {
    try {
      if (window.mkposDesktop?.getPrinters) {
        setPrinters(await window.mkposDesktop.getPrinters());
        return;
      }
      const payload = await request('/settings/printers');
      setPrinters(payload.items || []);
    } catch (err) {
      setError(`Cannot load Windows printers. ${err.message}`);
    }
  }

  async function loadReceiptPreview(nextSettings = settings) {
    try {
      setPreviewLoading(true);
      const payload = sampleReceiptPayload(receiptPreviewSettings(nextSettings));
      setReceiptPreview(payload);
    } catch (err) {
      setError(`Cannot prepare receipt preview. ${err.message}`);
    } finally {
      setPreviewLoading(false);
    }
  }

  useLatestEffect(() => {
    loadAccount()
      .then((session) => Promise.all([
        loadSettings(),
        loadPrinters(),
        ...(session?.user?.role === 'owner' ? [loadDataState(), loadPriceTypes()] : []),
      ]))
      .finally(() => setLoading(false));
  }, []);

  useDataRefresh(['settings', 'priceTypes'], 'settings', () => Promise.all([
    loadSettings(true),
    ...(account.role === 'owner' ? [loadDataState(), loadPriceTypes()] : []),
  ]));

  useLatestEffect(() => {
    if (!visibleTabs.some((tab) => tab.id === activeTab)) setActiveTab('account');
  }, [account.role, activeTab]);

  useLatestEffect(() => {
    if (activeTab !== 'receipt' || loading) return undefined;
    const timer = window.setTimeout(() => loadReceiptPreview(settings), 180);
    return () => window.clearTimeout(timer);
  }, [
    activeTab,
    loading,
    settings.shop_name,
    settings.shop_title,
    settings.shop_address,
    settings.shop_phone,
    settings.currency,
    settings.receipt_footer,
    settings.receipt_logo_data_url,
    settings.receipt_show_customer,
    settings.receipt_show_payment_method,
    settings.receipt_show_price_type,
    settings.receipt_paper_size,
    settings.receipt_header_alignment,
    settings.receipt_margin_left,
    settings.receipt_margin_right,
    settings.receipt_header_font_size,
    settings.receipt_body_font_size,
    settings.receipt_line_height,
  ]);

  function patchSettings(patch) {
    Object.keys(patch).forEach(key => dirtySettingKeys.current.add(key));
    setSettings((current) => ({ ...current, ...patch }));
  }

  function patchAccount(patch) {
    setAccount((current) => ({ ...current, ...patch }));
  }

  async function uploadLogo(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setLogoBusy(true);
    setMessage('');
    setError('');
    try {
      const body = new FormData();
      body.append('logo', file);
      const saved = await request('/settings/logo', { method: 'POST', body, timeoutMs: 30000 });
      setSettings((current) => withDeviceLayout({ ...current, ...saved }, printerConfig));
      emitDataChange(['settings'], 'settings');
      setMessage('Business logo updated. It will appear in your shop and on receipts.');
    } catch (err) {
      setError(err.message);
    } finally {
      setLogoBusy(false);
    }
  }

  async function deleteLogo() {
    const { confirmed } = await confirmAction({
      title: 'Remove business logo',
      message: 'Remove this logo from your customer shop and future receipts?',
      confirmLabel: 'Remove logo',
    });
    if (!confirmed) return;
    setLogoBusy(true);
    setMessage('');
    setError('');
    try {
      const saved = await request('/settings/logo', { method: 'DELETE' });
      setSettings((current) => withDeviceLayout({ ...current, ...saved }, printerConfig));
      emitDataChange(['settings'], 'settings');
      setMessage('Business logo removed.');
    } catch (err) {
      setError(err.message);
    } finally {
      setLogoBusy(false);
    }
  }

  async function saveAccount(event) {
    event.preventDefault();
    setAccountBusy(true);
    setMessage('');
    setError('');
    try {
      const session = await request('/auth/profile', {
        method: 'PUT',
        body: JSON.stringify({
          name: account.name.trim(),
          email: account.email.trim(),
          current_password: account.current_password,
          password: account.password || null,
          password_confirmation: account.password_confirmation || null,
        }),
      });
      setAccount((current) => ({
        ...current,
        name: session.user.name,
        email: session.user.email,
        role: session.user.role,
        current_password: '',
        password: '',
        password_confirmation: '',
      }));
      window.dispatchEvent(new CustomEvent('mkpos:session-updated', { detail: session }));
      setMessage('Profile and sign-in credentials updated.');
    } catch (err) {
      setError(err.message);
    } finally {
      setAccountBusy(false);
    }
  }

  async function persistPrinterSettings(source = settings) {
    if (!printerConfig) throw new Error('Printer settings are not loaded. Reopen Settings and try again.');
    const clean = await window.mkposDesktop.savePrinterConfig(simplePrinterConfig({ ...printerConfig, receiptLayout: deviceLayout(source) }));
    setPrinterConfig(clean);
    return clean;
  }

  async function saveSettings(patch = {}) {
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const payload = settingsPayload(settings, patch);
      const serverPayload = window.mkposDesktop?.savePrinterConfig ? sharedSettingsPayload(payload) : { ...payload };
      if (window.mkposDesktop?.setPrinterPreference) delete serverPayload.printer_name;
      if (window.mkposDesktop?.savePrinterConfig) await persistPrinterSettings(payload);
      const saved = await request('/settings', {
        method: 'PUT',
        body: JSON.stringify(serverPayload),
      });
      if (!window.mkposDesktop?.savePrinterConfig) await window.mkposDesktop?.setPrinterPreference?.(payload.printer_name);
      if (!window.mkposDesktop?.savePrinterConfig && !Object.hasOwn(saved, 'receipt_paper_size')) {
        throw new Error('The running PwarMyar backend is outdated. Restart PwarMyar, then save the receipt paper setting again.');
      }
      setSettings(withDeviceLayout({ ...defaultSettings(), ...saved, ...(window.mkposDesktop?.setPrinterPreference ? { printer_name: payload.printer_name } : {}) }, window.mkposDesktop?.savePrinterConfig ? { receiptLayout: deviceLayout(payload) } : null));
      setLanguage(saved.language);
      dirtySettingKeys.current.clear();
      setPaymentRows(paymentMethodRows(saved.payment_methods));
      setMessage(t('settings.text.saved'));
      emitDataChange(['settings'], 'settings');
    } catch (err) {
      if (window.mkposDesktop?.savePrinterConfig && /receipt.paper.size|receipt.header.alignment/i.test(err.message)) {
        setError('Printer settings were saved on this device. Shared settings could not be saved because the server needs the device-specific printing update. Deploy the updated SettingsController; local printer values will not be sent to other tills.');
      } else setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function savePaymentMethods() {
    const cleanRows = [...new Set(paymentRows.map((row) => row.name.trim()).filter(Boolean))];
    if (!cleanRows.length) {
      setError('At least one payment method is required.');
      return;
    }
    setPaymentRows(cleanRows.map((name, index) => ({ id: `${Date.now()}-clean-${index}`, name })));
    await saveSettings({ payment_methods: cleanRows.join(',') });
  }

  async function testPrint() {
    setTestPrinting(true);
    setMessage('');
    setError('');
    try {
      if (window.mkposDesktop?.printReceipt) {
        const preview = sampleReceiptPayload(receiptPreviewSettings(settings));
        setReceiptPreview(preview);
        // Test the current selection even before the whole settings form is saved.
        if (window.mkposDesktop?.savePrinterConfig) await persistPrinterSettings();
        else await window.mkposDesktop?.setPrinterPreference?.(settings.printer_name);
        const printResult = await printReceiptText(
          preview.text,
          preview.paper_size || settings.receipt_paper_size,
          { html: preview.html, layout: preview.layout, printerName: settings.printer_name },
        );
        setMessage(printResultMessage(printResult));
        return;
      }
      const result = await request('/settings/test-print', {
        method: 'POST',
        body: JSON.stringify(settingsPayload(settings)),
      });
      if (!result.ok) {
        await printReceiptText(
          result.text || receiptPreview.text,
          result.paper_size || settings.receipt_paper_size,
          {
            html: result.html || receiptPreview.html,
            layout: result.layout || receiptPreview.layout,
            printerName: settings.printer_name,
          },
        );
      }
      setMessage(result.ok ? (result.message || 'Test receipt sent to printer.') : 'Test receipt opened in the browser print dialog.');
    } catch (err) {
      setError(err.message);
    } finally {
      setTestPrinting(false);
    }
  }

  function resetReceiptLayout() {
    const thermal = !['a4', 'a5'].includes(settings.receipt_paper_size);
    patchSettings({
      receipt_header_alignment: 'center',
      receipt_margin_left: thermal ? 3 : 14,
      receipt_margin_right: thermal ? 3 : 14,
      receipt_header_font_size: thermal ? 11 : 14,
      receipt_body_font_size: thermal ? 8.2 : 10.5,
      receipt_line_height: 1.45,
    });
  }

  function applyPriceTypePayload(payload) {
    setPriceTypeRows(editablePriceTypeRows(payload.items, payload.usage, payload.rules));
    emitDataChange(['priceTypes', 'products'], 'settings');
  }

  async function addPriceType() {
    const name = newPriceType.trim();
    if (!name) {
      setError('Enter a price type name.');
      return;
    }
    setPriceTypeBusy('new');
    setMessage('');
    setError('');
    try {
      const payload = await request('/price-types', {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
      applyPriceTypePayload(payload);
      setNewPriceType('');
      setMessage('Price type added.');
    } catch (err) {
      setError(priceTypeErrorMessage(err));
    } finally {
      setPriceTypeBusy('');
    }
  }

  async function updatePriceType(row) {
    const name = row.name.trim();
    if (!name) {
      setError('Price type name cannot be empty.');
      return;
    }
    if (row.applyToExisting && row.pricingMode === 'automatic') {
      const { confirmed } = await confirmAction({
        title: 'Apply automatic pricing',
        message: `Apply this rule to ${row.productCount || 'all'} existing product price(s)? Their current ${row.originalName} prices will be replaced by prices calculated from the latest buying cost.`,
        confirmLabel: 'Apply and Save',
      });
      if (!confirmed) return;
    }
    setPriceTypeBusy(row.id);
    setMessage('');
    setError('');
    try {
      const payload = await request(`/price-types/${encodeURIComponent(row.originalName)}`, {
        method: 'PUT',
        body: JSON.stringify({
          name,
          pricing_mode: row.pricingMode,
          markup_percent: Number(row.markupPercent || 0),
          rounding: Math.max(Number(row.rounding || 1), 1),
          minimum_profit: Math.max(Number(row.minimumProfit || 0), 0),
          apply_to_existing: Boolean(row.applyToExisting),
        }),
      });
      applyPriceTypePayload(payload);
      setMessage('Price type updated.');
    } catch (err) {
      setError(priceTypeErrorMessage(err));
    } finally {
      setPriceTypeBusy('');
    }
  }

  async function deletePriceType(row) {
    const { confirmed } = await confirmAction({
      title: 'Delete price type',
      message: `Delete the unused price type "${row.originalName}"?`,
      confirmLabel: 'Delete Price Type',
    });
    if (!confirmed) return;
    setPriceTypeBusy(row.id);
    setMessage('');
    setError('');
    try {
      const payload = await request(`/price-types/${encodeURIComponent(row.originalName)}`, {
        method: 'DELETE',
      });
      applyPriceTypePayload(payload);
      setMessage('Price type deleted.');
    } catch (err) {
      setError(priceTypeErrorMessage(err));
    } finally {
      setPriceTypeBusy('');
    }
  }

  async function createBackup() {
    setDataBusy(true);
    setMessage('');
    setError('');
    try {
      const { blob, headers } = await requestDownload('/data/export', { accept: 'application/gzip' });
      const disposition = headers['content-disposition'] || '';
      const filename = disposition.match(/filename="?([^";]+)"?/i)?.[1] || `mkpos-backup-${new Date().toISOString().slice(0, 10)}.mkpos-backup`;
      await saveBlobWithPicker(blob, filename);
      await loadDataState();
      setMessage(t('settings.text.backupCreated'));
    } catch (err) {
      if (err?.name !== 'AbortError') setError(err.message);
    } finally {
      setDataBusy(false);
    }
  }

  async function restoreBackup() {
    if (!restoreFile) {
      setError('Choose a restore file first.');
      return;
    }
    if (restoreConfirm !== 'RESTORE') {
      setError('Type RESTORE to confirm database restore.');
      return;
    }
    setDataBusy(true);
    setMessage('');
    setError('');
    try {
      const formData = new FormData();
      formData.append('backup', restoreFile);
      formData.append('confirmation', restoreConfirm);
      if (restorePin) formData.append('admin_pin', restorePin);
      const result = await request('/data/restore-file', {
        method: 'POST',
        body: formData,
        timeoutMs: 120000,
      });
      setRestoreConfirm('');
      setRestorePin('');
      setRestoreFile(null);
      if (restoreFileInputRef.current) restoreFileInputRef.current.value = '';
      await Promise.all([loadSettings(), loadDataState()]);
      setMessage(`${t('settings.text.restored')} ${Number(result.records_restored || 0).toLocaleString()} records restored.`);
      emitDataChange(['*'], 'settings');
    } catch (err) {
      setError(err.message);
    } finally {
      setDataBusy(false);
    }
  }

  async function resetBusinessData() {
    if (resetConfirm !== 'RESET') {
      setError('Type RESET to confirm clearing this business data.');
      return;
    }
    const { confirmed } = await confirmAction({
      title: 'Start with a fresh business',
      message: 'Clear all operational data and shop settings? Your business account, users, access roles, and subscription records will be preserved. A server-side safety backup will be created first.',
      confirmLabel: 'Clear Business Data',
    });
    if (!confirmed) return;

    setDataBusy(true);
    setMessage('');
    setError('');
    try {
      const result = await request('/data/reset', {
        method: 'POST',
        body: JSON.stringify({ confirmation: resetConfirm, admin_pin: resetPin }),
        timeoutMs: 120000,
      });
      setResetConfirm('');
      setResetPin('');
      await Promise.all([loadSettings(), loadDataState(), loadPriceTypes()]);
      setMessage(`${Number(result.records_cleared || 0).toLocaleString()} business records cleared. Your account and subscription were preserved.`);
      emitDataChange(['*'], 'settings');
    } catch (err) {
      setError(err.message);
    } finally {
      setDataBusy(false);
    }
  }

  function selectRestoreFile(event) {
    setRestoreFile(event.target.files?.[0] || null);
  }

  function renderPanelActions() {
    const saveLabel = actionLabel(saving, t('settings.actions.saving'), t('settings.actions.save'));
    switch (activeTab) {
      case 'account': return <button form="settings-account-form" className="primary" disabled={accountBusy}><KeyRound size={16} />{accountBusy ? 'Saving account...' : 'Save account'}</button>;
      case 'timezone': return null;
      case 'shop': return <button form="settings-shop-form" className="primary" disabled={saving}>{saveLabel}</button>;
      case 'printer': return <><button type="button" disabled={testPrinting || printing || saving} onClick={testPrint}><Printer size={16} /> {t('Test Print')}</button><button form="settings-printer-form" className="primary" disabled={saving}>{saveLabel}</button></>;
      case 'barcode': return <button form="settings-barcode-form" className="primary" disabled={saving}>{saveLabel}</button>;
      case 'receipt': return <><button type="button" onClick={() => setReceiptPreviewOpen(true)}><Eye size={16} /> {t('Receipt Preview')}</button><button type="button" disabled={testPrinting || previewLoading || printing || saving} onClick={testPrint}><Printer size={16} /> {actionLabel(testPrinting, t('Printing...'), t('Test Print'))}</button><button form="settings-receipt-form" className="primary" disabled={saving}>{saveLabel}</button></>;
      case 'payments': return <><button type="button" onClick={() => setPaymentRows((current) => [...current, { id: `${Date.now()}-new-${Math.random().toString(36).slice(2)}`, name: '' }])}><Plus size={15} /> {t('settings.actions.addMethod')}</button><button type="button" className="primary" disabled={saving} onClick={savePaymentMethods}>{saveLabel}</button></>;
      case 'prices': return <div className="settings-new-price"><input aria-label="New price type" value={newPriceType} onChange={(event) => setNewPriceType(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addPriceType(); } }} placeholder="New price type, for example Member" /><button type="button" className="primary" disabled={priceTypeBusy === 'new'} onClick={addPriceType}><Plus size={15} /> {priceTypeBusy === 'new' ? 'Adding...' : 'Add Price Type'}</button></div>;
      case 'security': return <button form="settings-security-form" className="primary" disabled={saving}>{saveLabel}</button>;
      case 'data': return null;
      case 'language': return <button form="settings-language-form" className="primary" disabled={saving}>{saveLabel}</button>;
      default: return <button type="button" onClick={() => Promise.all([loadSettings(), loadAccount(), loadDataState(), loadPriceTypes(), loadPrinters()])}><RotateCcw size={15} /> Refresh information</button>;
    }
  }

  if (loading) {
    return (
      <section className="screen settings-screen mkpos-sheet">
        <LoadingState>Loading settings...</LoadingState>
      </section>
    );
  }

  return (
    <section className="screen settings-screen mkpos-sheet">

      <div className="settings-workspace">
        <div className="settings-side-tabs">
          {visibleTabs.map((tab) => (
            <button key={tab.id} type="button" aria-label={t(`settings.tabs.${tab.id}`)} className={activeTab === tab.id ? 'selected' : ''} onClick={() => setActiveTab(tab.id)}>
              <tab.icon size={16} />
              <span><strong>{t(`settings.tabs.${tab.id}`)}</strong><small>{tab.subtitle}</small></span>
            </button>
          ))}
        </div>

        <div className={activeTab === 'data' ? 'settings-panel settings-panel--data' : 'settings-panel'}>
          {activeTab !== 'data' && <div className="settings-panel-heading">
            <span className="settings-panel-icon"><activeTabInfo.icon size={20} /></span>
            <div>
              <strong>{t(`settings.tabs.${activeTabInfo.id}`)}</strong>
              <span>{activeTabInfo.subtitle}</span>
            </div>
          </div>}
          <div className="settings-panel-content" key={activeTab}>
          {activeTab === 'timezone' && <BusinessTimezoneSettings onCancel={() => setActiveTab('shop')} onSaved={() => setMessage('Business time zone saved.')} />}
          {activeTab === 'account' && (
            <form id="settings-account-form" className="settings-form settings-account-form" onSubmit={saveAccount}>
              <div className="settings-account-summary">
                <span>{account.name.trim().charAt(0).toUpperCase() || 'O'}</span>
                <div><strong>{account.name || 'Team member'}</strong><small>{account.email || 'No email address'}</small></div>
                <em>{account.role}</em>
              </div>

              <section className="settings-account-section">
                <div className="settings-account-section-heading"><UserRound size={17} /><span><strong>Profile information</strong><small>Used in the dashboard and account identification.</small></span></div>
                <div className="settings-form-grid">
                  <Field label={account.role === 'owner' ? 'Owner name' : 'Name'}><input required value={account.name} onChange={(event) => patchAccount({ name: event.target.value })} autoComplete="name" /></Field>
                  <Field label="Email address"><input required type="email" value={account.email} onChange={(event) => patchAccount({ email: event.target.value })} autoComplete="email" /></Field>
                </div>
              </section>

              <section className="settings-account-section">
                <div className="settings-account-section-heading"><KeyRound size={17} /><span><strong>Password and security</strong><small>Confirm your current password before saving any account changes.</small></span></div>
                <div className="settings-account-password-grid">
                  <Field label="Current password"><input required type="password" value={account.current_password} onChange={(event) => patchAccount({ current_password: event.target.value })} autoComplete="current-password" /></Field>
                  <Field label="New password"><input type="password" minLength="8" value={account.password} onChange={(event) => patchAccount({ password: event.target.value })} autoComplete="new-password" placeholder="Leave blank to keep current password" /></Field>
                  <Field label="Confirm new password"><input type="password" minLength="8" required={Boolean(account.password)} value={account.password_confirmation} onChange={(event) => patchAccount({ password_confirmation: event.target.value })} autoComplete="new-password" /></Field>
                </div>
                <div className="settings-account-security-note"><LockKeyhole size={16} /><span>Your current password is checked securely and is never displayed.</span></div>
              </section>

            </form>
          )}

          {activeTab === 'shop' && (
            <form id="settings-shop-form" className="settings-form settings-shop-form" onSubmit={(event) => { event.preventDefault(); saveSettings(); }}>
              <section className="settings-logo-section">
                <div className="settings-logo-preview">
                  {settings.receipt_logo_data_url
                    ? <img src={settings.receipt_logo_data_url} alt="Current business logo" />
                    : <Store size={30} aria-hidden="true" />}
                </div>
                <div className="settings-logo-copy">
                  <strong>Business logo</strong>
                  <span>Shared with your customer shop, receipt previews and printed receipts.</span>
                  <small>PNG, JPG, or WebP · maximum 512 KB and 2400 × 2400 px.</small>
                </div>
                <div className="settings-logo-actions">
                  <input ref={logoFileInputRef} className="settings-logo-input" type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadLogo} />
                  <button type="button" disabled={logoBusy} onClick={() => logoFileInputRef.current?.click()}><Upload size={15} />{logoBusy ? 'Updating...' : settings.receipt_logo_data_url ? 'Replace logo' : 'Upload logo'}</button>
                  {settings.receipt_logo_data_url && <button type="button" className="danger-button" disabled={logoBusy} onClick={deleteLogo}><Trash2 size={15} />Remove</button>}
                </div>
              </section>
              <div className="settings-form-grid">
                <Field label={t('settings.labels.shopName')}><input value={settings.shop_name} onChange={(event) => patchSettings({ shop_name: event.target.value })} /></Field>
                <Field label={t('settings.labels.address')}><input value={settings.shop_address} onChange={(event) => patchSettings({ shop_address: event.target.value })} /></Field>
                <Field label={t('settings.labels.phone')}><input value={settings.shop_phone} onChange={(event) => patchSettings({ shop_phone: event.target.value })} /></Field>
                <Field label={t('settings.labels.currency')}><input value={settings.currency} onChange={(event) => patchSettings({ currency: event.target.value })} /></Field>
              </div>
            </form>
          )}

          {activeTab === 'printer' && (
              <form id="settings-printer-form" className="settings-form settings-printer-form" onSubmit={(event) => { event.preventDefault(); saveSettings(); }}>
                <section className="settings-receipt-section">
                  {window.mkposDesktop?.getPrinterConfig ? (printerConfig ? <PrinterSettings
                    config={{ ...printerConfig, receiptLayout: deviceLayout(settings) }} onChange={setPrinterConfig}
                    printers={printers} onRefresh={loadPrinters} paper={settings.receipt_paper_size}
                    onPaperChange={receipt_paper_size => patchSettings({ receipt_paper_size })}
                    onSave={persistPrinterSettings} busy={saving || printing || testPrinting}
                  /> : <LoadingState>Loading device printer settings...</LoadingState>) : <>
                  <div className="settings-receipt-section-heading">
                    <strong>{t('Printer Setup')}</strong>
                    <button type="button" onClick={loadPrinters}><RotateCcw size={15} /> {t('Refresh Printers')}</button>
                  </div>
                  <div className="settings-form-grid">
                    <PrinterInput label={t('settings.labels.printer')}
                      value={settings.printer_name} printers={printers} onRefresh={loadPrinters}
                      onChange={(printer_name) => patchSettings({ printer_name })}
                      placeholder={t('Select or type Windows printer name')} />
                    <Field label={t('settings.labels.paperSize')}>
                      <select value={settings.receipt_paper_size} onChange={(event) => patchSettings({ receipt_paper_size: event.target.value })}>
                        <option value="50mm">50 mm Thermal</option>
                        <option value="58mm">58 mm Thermal</option>
                        <option value="80mm">80 mm Thermal</option>
                        <option value="85mm">85 mm Thermal</option>
                        <option value="a5">A5 / Normal Printer</option>
                        <option value="a4">A4 / Normal Printer</option>
                      </select>
                    </Field>
                  </div>
                  <div className="info-box">{t('settings.text.paperHelp')}</div>
                  {window.mkposDesktop && /^(Microsoft Print to PDF|Adobe PDF)$/i.test(settings.printer_name) && <div className="info-box">This PDF selection opens Save as PDF using PwarMyar's built-in exporter. It preserves your selected receipt width without requiring a Windows PDF driver paper size.</div>}
                  {window.mkposDesktop && <div className="info-box">For CrossEscPos select <strong>escpos://127.0.0.1:9100</strong> and start its TCP listener. This sends thermal receipts directly to the local emulator. Your printer selection is saved on this computer. Statements and barcode lists use the Windows default printer with A4 paper.</div>}
                  </>}
                </section>

              </form>
          )}

          {activeTab === 'receipt' && (
            <div className="settings-receipt-workspace">
              <form id="settings-receipt-form" className="settings-form settings-receipt-form" onSubmit={(event) => { event.preventDefault(); saveSettings(); }}>
                <div className="info-box settings-receipt-printer-notice">
                  <span>Paper: {settings.receipt_paper_size}. Choose paper and printer connection in Printer settings.</span>
                  <button type="button" onClick={() => setActiveTab('printer')}>Printer settings</button>
                </div>

                <section className="settings-receipt-section">
                  <div className="settings-receipt-section-heading"><strong>{t('Receipt Content')}</strong></div>
                  <Field label={t('settings.labels.shopTitle')}><input value={settings.shop_title} onChange={(event) => patchSettings({ shop_title: event.target.value })} /></Field>
                  <Field label={t('settings.labels.footer')}><textarea value={settings.receipt_footer} onChange={(event) => patchSettings({ receipt_footer: event.target.value })} /></Field>
                  <div className="settings-check-grid settings-receipt-options">
                    <label><input type="checkbox" checked={settings.receipt_show_customer === '1'} onChange={(event) => patchSettings({ receipt_show_customer: event.target.checked ? '1' : '0' })} /> {t('settings.labels.showCustomer')}</label>
                    <label><input type="checkbox" checked={settings.receipt_show_payment_method === '1'} onChange={(event) => patchSettings({ receipt_show_payment_method: event.target.checked ? '1' : '0' })} /> {t('settings.labels.showPayment')}</label>
                    <label><input type="checkbox" checked={settings.receipt_show_price_type === '1'} onChange={(event) => patchSettings({ receipt_show_price_type: event.target.checked ? '1' : '0' })} /> {t('settings.labels.showPriceType')}</label>
                  </div>
                </section>

                <section className="settings-receipt-section">
                  <div className="settings-receipt-section-heading">
                    <strong>{t('Receipt Layout')}</strong>
                    <button type="button" onClick={resetReceiptLayout}><RotateCcw size={15} /> {t('Recommended Layout')}</button>
                  </div>
                  <div className="settings-layout-grid">
                    <Field label={t('Header Alignment')}>
                      <select value={settings.receipt_header_alignment} onChange={(event) => patchSettings({ receipt_header_alignment: event.target.value })}>
                        <option value="left">{t('Left')}</option>
                        <option value="center">{t('Center')}</option>
                        <option value="right">{t('Right')}</option>
                      </select>
                    </Field>
                    <Field label={t('Left Margin (mm)')}>
                      <input type="number" min="0" max={['a4', 'a5'].includes(settings.receipt_paper_size) ? 30 : 12} step="0.5" value={settings.receipt_margin_left} onChange={(event) => patchSettings({ receipt_margin_left: event.target.value })} />
                    </Field>
                    <Field label={t('Right Margin (mm)')}>
                      <input type="number" min="0" max={['a4', 'a5'].includes(settings.receipt_paper_size) ? 30 : 12} step="0.5" value={settings.receipt_margin_right} onChange={(event) => patchSettings({ receipt_margin_right: event.target.value })} />
                    </Field>
                    <Field label={t('Header Size (pt)')}>
                      <input type="number" min="7" max="24" step="0.5" value={settings.receipt_header_font_size} onChange={(event) => patchSettings({ receipt_header_font_size: event.target.value })} />
                    </Field>
                    <Field label={t('Body Size (pt)')}>
                      <input type="number" min="6" max="18" step="0.1" value={settings.receipt_body_font_size} onChange={(event) => patchSettings({ receipt_body_font_size: event.target.value })} />
                    </Field>
                    <Field label={t('Line Spacing')}>
                      <input type="number" min="1" max="2.2" step="0.05" value={settings.receipt_line_height} onChange={(event) => patchSettings({ receipt_line_height: event.target.value })} />
                    </Field>
                  </div>
                  <div className="info-box">{t('The preview uses your current shop name, title, address, phone, and sample products.')}</div>
                </section>

              </form>

            </div>
          )}

          {activeTab === 'barcode' && (
            <form id="settings-barcode-form" className="settings-form" onSubmit={(event) => { event.preventDefault(); saveSettings(); }}>
              <section className="settings-receipt-section">
                <div className="settings-receipt-section-heading"><strong>Barcode sticker format</strong></div>
                <div className="info-box">Choose the physical sticker stock loaded in the printer. Printing uses the exact page and sticker dimensions—without a report heading.</div>
                <div className="settings-form-grid">
                  <Field label="Sticker paper format"><select value={settings.barcode_label_format} onChange={(event) => patchSettings({ barcode_label_format: event.target.value })}>{Object.entries(BARCODE_LABEL_FORMATS).map(([value, format]) => <option value={value} key={value}>{format.label}</option>)}</select></Field>
                </div>
                {String(settings.barcode_label_format).startsWith('custom_') && <div className="settings-form-grid">
                  {settings.barcode_label_format === 'custom_sheet' && <><Field label="Paper width (mm)"><input type="number" min="20" max="400" step=".1" value={settings.barcode_page_width_mm} onChange={(event) => patchSettings({ barcode_page_width_mm: event.target.value })} /></Field><Field label="Paper height (mm)"><input type="number" min="20" max="600" step=".1" value={settings.barcode_page_height_mm} onChange={(event) => patchSettings({ barcode_page_height_mm: event.target.value })} /></Field></>}
                  <Field label="Sticker width (mm)"><input type="number" min="15" max="200" step=".1" value={settings.barcode_label_width_mm} onChange={(event) => patchSettings({ barcode_label_width_mm: event.target.value, ...(settings.barcode_label_format === 'custom_roll' ? { barcode_page_width_mm: event.target.value } : {}) })} /></Field>
                  <Field label="Sticker height (mm)"><input type="number" min="18" max="120" step=".1" value={settings.barcode_label_height_mm} onChange={(event) => patchSettings({ barcode_label_height_mm: event.target.value, ...(settings.barcode_label_format === 'custom_roll' ? { barcode_page_height_mm: event.target.value } : {}) })} /></Field>
                  {settings.barcode_label_format === 'custom_sheet' && <><Field label="Side margin (mm)"><input type="number" min="0" max="30" step=".1" value={settings.barcode_margin_x_mm} onChange={(event) => patchSettings({ barcode_margin_x_mm: event.target.value })} /></Field><Field label="Top margin (mm)"><input type="number" min="0" max="30" step=".1" value={settings.barcode_margin_y_mm} onChange={(event) => patchSettings({ barcode_margin_y_mm: event.target.value })} /></Field><Field label="Horizontal gap (mm)"><input type="number" min="0" max="20" step=".1" value={settings.barcode_gap_x_mm} onChange={(event) => patchSettings({ barcode_gap_x_mm: event.target.value })} /></Field><Field label="Vertical gap (mm)"><input type="number" min="0" max="20" step=".1" value={settings.barcode_gap_y_mm} onChange={(event) => patchSettings({ barcode_gap_y_mm: event.target.value })} /></Field></>}
                </div>}
                {(() => { const layout = normalizeBarcodeSettings(settings); return <div className="info-box"><strong>{layout.labelWidth} × {layout.labelHeight} mm sticker</strong> · {layout.mode === 'roll' ? 'one sticker per printed page' : `${layout.columns} columns × ${layout.rows} rows (${layout.labelsPerPage} stickers per page)`}</div>; })()}
                <div className="settings-check-grid settings-receipt-options">
                  <label><input type="checkbox" checked={settings.barcode_show_name === '1'} onChange={(event) => patchSettings({ barcode_show_name: event.target.checked ? '1' : '0' })} /> Show product name</label>
                  <label><input type="checkbox" checked={settings.barcode_show_value === '1'} onChange={(event) => patchSettings({ barcode_show_value: event.target.checked ? '1' : '0' })} /> Show barcode number</label>
                </div>
                <BarcodeLivePreview settings={settings} />
              </section>
            </form>
          )}

          {activeTab === 'payments' && (
            <div className="settings-form settings-payments-form">
              <div className="settings-payment-list">
                {paymentRows.map((row, index) => (
                  <div className="settings-payment-row" key={row.id}>
                    <span className="settings-payment-index">{index + 1}</span>
                    <input value={row.name} onChange={(event) => setPaymentRows((current) => current.map((item) => (item.id === row.id ? { ...item, name: event.target.value } : item)))} />
                    <button type="button" className="danger-button" aria-label={`Remove payment method ${row.name || 'row'}`} title="Remove payment method" onClick={() => setPaymentRows((current) => current.filter((item) => item.id !== row.id))}><Trash2 size={15} /></button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'prices' && (
            <div className="settings-form settings-prices-form">
              <div className="settings-price-intro">
                Automatic prices use the latest buying cost. The price is rounded upward so the configured profit is not reduced. Existing product prices stay manual unless you apply the rule to them.
              </div>
              <div className="settings-price-list">
                {priceTypeRows.map((row, index) => (
                  <div className="settings-price-row" key={row.id}>
                    <div className="settings-price-row-main">
                      <span className="settings-payment-index">{index + 1}</span>
                      <input
                        value={row.name}
                        onChange={(event) => setPriceTypeRows((current) => current.map((item) => (
                          item.id === row.id ? { ...item, name: event.target.value } : item
                        )))}
                      />
                      <span className={row.productCount > 0 ? 'settings-price-usage connected' : 'settings-price-usage'}>
                        {row.productCount > 0 ? `${row.productCount} product${row.productCount === 1 ? '' : 's'}` : 'Not used'}
                      </span>
                      <button
                        type="button"
                        className="danger-button"
                        aria-label={`Delete price type ${row.originalName}`}
                        title={row.productCount > 0 ? `Used by ${row.productCount} product(s)` : 'Delete price type'}
                        disabled={priceTypeBusy === row.id || priceTypeRows.length <= 1 || row.productCount > 0}
                        onClick={() => deletePriceType(row)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                    <div className="settings-price-rule-controls">
                      <Field label="Pricing">
                        <select
                          value={row.pricingMode}
                          onChange={(event) => setPriceTypeRows((current) => current.map((item) => (
                            item.id === row.id ? { ...item, pricingMode: event.target.value } : item
                          )))}
                        >
                          <option value="manual">Manual</option>
                          <option value="automatic">Automatic</option>
                        </select>
                      </Field>
                      <Field label="Markup %">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          disabled={row.pricingMode !== 'automatic'}
                          value={row.markupPercent}
                          onChange={(event) => setPriceTypeRows((current) => current.map((item) => (
                            item.id === row.id ? { ...item, markupPercent: event.target.value } : item
                          )))}
                        />
                      </Field>
                      <Field label="Round up to">
                        <select
                          disabled={row.pricingMode !== 'automatic'}
                          value={row.rounding}
                          onChange={(event) => setPriceTypeRows((current) => current.map((item) => (
                            item.id === row.id ? { ...item, rounding: event.target.value } : item
                          )))}
                        >
                          {[1, 10, 50, 100, 500, 1000].map((value) => <option key={value} value={value}>{value} Ks</option>)}
                        </select>
                      </Field>
                      <Field label="Minimum profit">
                        <input
                          type="number"
                          min="0"
                          disabled={row.pricingMode !== 'automatic'}
                          value={row.minimumProfit}
                          onChange={(event) => setPriceTypeRows((current) => current.map((item) => (
                            item.id === row.id ? { ...item, minimumProfit: event.target.value } : item
                          )))}
                        />
                      </Field>
                    </div>
                    <div className="settings-price-row-actions">
                      <button type="button" className="primary" disabled={priceTypeBusy === row.id} onClick={() => updatePriceType(row)}>
                        {priceTypeBusy === row.id ? 'Saving...' : 'Save Rule'}
                      </button>
                      <label className="settings-price-apply">
                        <input
                          type="checkbox"
                          disabled={row.pricingMode !== 'automatic'}
                          checked={row.applyToExisting}
                          onChange={(event) => setPriceTypeRows((current) => current.map((item) => (
                            item.id === row.id ? { ...item, applyToExisting: event.target.checked } : item
                          )))}
                        />
                        Apply to existing products
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <form id="settings-security-form" className="settings-form settings-security-form" onSubmit={(event) => { event.preventDefault(); saveSettings(); }}>
              <div className={settings.admin_pin_set === '1' ? 'info-box' : 'info-box warning-box'}>
                <ShieldAlert size={17} /> {settings.admin_pin_set === '1' ? t('settings.text.pinSet') : t('settings.text.pinWarning')}
              </div>
              <Field label={t('settings.labels.adminPin')}><input type="password" value={settings.admin_pin} onChange={(event) => patchSettings({ admin_pin: event.target.value })} placeholder="Leave blank to keep current PIN" /></Field>
            </form>
          )}

          {activeTab === 'data' && (
            <div className="settings-form settings-data-form">
              {trialRestricted && (
                <div className="warning-box info-box settings-plan-notice" role="status">
                  <ShieldAlert size={17} />
                  <span>Backup download and data restore require a paid plan.</span>
                  {account.role === 'owner' && <button type="button" onClick={openBilling}>View Billing</button>}
                </div>
              )}
              <div className="settings-data-summary">
                <div><span className="settings-data-icon"><CircleCheck size={19} /></span><span>Database</span><strong>{dataStatus?.ok ? 'Online MySQL' : 'Needs attention'}</strong></div>
                <div><span className="settings-data-icon"><Database size={19} /></span><span>Business Records</span><strong>{Number(dataStatus?.total_records || 0).toLocaleString()}</strong></div>
                <div><span className="settings-data-icon"><Database size={19} /></span><span>Data Version</span><strong>{dataStatus?.schema_version ?? '-'}</strong></div>
              </div>
              <div className="settings-data-sections">
                <section className="settings-data-section settings-backup-section">
                  <header className="settings-data-section-header"><span><Download size={17} /></span><div><strong>Create backup</strong><small>Download a portable copy of this business's operational data.</small></div></header>
                  <div className="settings-data-section-body">
                    <div className="info-box settings-server-backup-note">
                      Includes products, prices, customers, suppliers, sales, purchases, payments, expenses, stock history, and shop settings. Accounts, passwords, staff roles, and subscriptions are excluded.
                    </div>
                  </div>
                  <footer className="settings-data-section-footer"><button type="button" className="primary" disabled={dataBusy || trialRestricted} onClick={createBackup}><Download size={16} />{actionLabel(dataBusy, 'Working...', t('settings.actions.saveBackupFile'))}</button></footer>
                </section>

                <section className="settings-data-section settings-restore-section">
                  <header className="settings-data-section-header"><span><Upload size={17} /></span><div><strong>Restore backup</strong><small>Replace this business's operational data from a backup file.</small></div></header>
                  <div className="settings-data-section-body">
                    <div className="warning-box info-box">{t('settings.text.dataWarning')}</div>
                    <div className="settings-file-actions">
                      <input ref={restoreFileInputRef} className="settings-restore-file-input" type="file" accept=".mkpos-backup,application/gzip" onChange={selectRestoreFile} disabled={trialRestricted} />
                      <span className="settings-file-icon"><Upload size={18} /></span>
                      <span className="settings-file-copy"><strong>{restoreFile ? restoreFile.name : 'Restore backup file'}</strong><small>{restoreFile ? t('settings.labels.selectedRestoreFile') : 'Choose an PwarMyar backup file from this device'}</small></span>
                      <button type="button" disabled={trialRestricted} onClick={() => restoreFileInputRef.current?.click()}>{restoreFile ? 'Replace file' : t('settings.actions.chooseRestoreFile')}</button>
                    </div>
                    <div className="settings-form-grid">
                      <Field label={t('settings.labels.restoreConfirm')}><input value={restoreConfirm} disabled={trialRestricted} onChange={(event) => setRestoreConfirm(event.target.value)} placeholder="RESTORE" /></Field>
                      {settings.admin_pin_set === '1' && <Field label={t('settings.labels.restorePin')}><input type="password" value={restorePin} disabled={trialRestricted} onChange={(event) => setRestorePin(event.target.value)} /></Field>}
                    </div>
                  </div>
                  <footer className="settings-data-section-footer"><button type="button" className="danger-button" disabled={dataBusy || !restoreFile || trialRestricted} onClick={restoreBackup}>{t('settings.actions.restoreChosenFile')}</button></footer>
                </section>

                <section className="settings-data-section settings-reset-section">
                  <header className="settings-data-section-header"><span><Trash2 size={17} /></span><div><strong>Start with a fresh business</strong><small>Clear this business's operational data and return its shop settings to defaults.</small></div></header>
                  <div className="settings-data-section-body">
                    <div className="warning-box info-box">
                      Products, prices, customers, suppliers, sales, purchases, payments, expenses, stock history, and shop settings will be cleared. Business identity, users, passwords, access roles, and subscription or billing records are preserved. A server-side safety backup is created first.
                    </div>
                    <div className="settings-form-grid">
                      <Field label="Type RESET to confirm"><input value={resetConfirm} onChange={(event) => setResetConfirm(event.target.value)} placeholder="RESET" /></Field>
                      {settings.admin_pin_set === '1' && <Field label="Admin PIN"><input type="password" value={resetPin} onChange={(event) => setResetPin(event.target.value)} /></Field>}
                    </div>
                  </div>
                  <footer className="settings-data-section-footer"><button type="button" className="danger-button" disabled={dataBusy || resetConfirm !== 'RESET'} onClick={resetBusinessData}><Trash2 size={16} />{actionLabel(dataBusy, 'Clearing...', 'Clear Business Data')}</button></footer>
                </section>
              </div>
            </div>
          )}

          {activeTab === 'language' && (
            <form id="settings-language-form" className="settings-form settings-language-form" onSubmit={(event) => { event.preventDefault(); saveSettings(); }}>
              <Field label={t('settings.labels.language')}>
                <select value={settings.language} onChange={(event) => patchSettings({ language: event.target.value })}>
                  <option value="en">English</option>
                  <option value="my">မြန်မာ</option>
                </select>
              </Field>
            </form>
          )}

          {activeTab === 'about' && (
            <div className="settings-about">
              <div className="settings-about-brand"><BrandImage className="settings-about-logo" src={BRAND_LOGO} alt="PwarMyar" /><div><strong>PwarMyar</strong><span>Simple local shop POS</span></div></div>
              <div><span>Application</span><strong>PwarMyar</strong></div>
              <div><span>Version</span><strong>{import.meta.env.VITE_DESKTOP_VERSION || packageInfo.version}</strong></div>
              <div><span>Mode</span><strong>Laravel Online POS</strong></div>
              <div><span>Data Location</span><strong>Stored on the configured Laravel server</strong></div>
              <div className="settings-about-contact">
                <span>Contact for more features and applications</span>
                {platformContacts.phone_numbers.length > 0 && <strong>{platformContacts.phone_numbers.join(' / ')}</strong>}
                {platformContacts.viber_numbers.length > 0 && <small>Viber: {platformContacts.viber_numbers.join(', ')}</small>}
                {platformContacts.telegram_url && <small>Telegram: <a href={platformContacts.telegram_url} target="_blank" rel="noreferrer">{platformContacts.telegram_url.replace(/^https:\/\/(?:www\.)?t\.me\//, '@')}</a></small>}
                {platformContacts.email && <small>Email: <a href={`mailto:${platformContacts.email}`}>{platformContacts.email}</a></small>}
                {platformContacts.community_url && <small>Community: <a href={platformContacts.community_url} target="_blank" rel="noreferrer">{platformContacts.community_label || 'Join the community'}</a></small>}
              </div>
              <div className="info-box">Operational shop data is stored in the Laravel MySQL database. Download regular per-business backups from the Data tab.</div>
            </div>
          )}
          </div>
          {!['data', 'timezone'].includes(activeTab) && <div className={`settings-panel-footer settings-panel-footer--${activeTab}`} key={`${activeTab}-actions`}>{renderPanelActions()}</div>}
        </div>
      </div>
      <Modal
        open={receiptPreviewOpen}
        title={t('Receipt Preview')}
        subtitle={t('Sample sale')}
        headerContent={<span className="settings-paper-badge">{String(settings.receipt_paper_size || '80mm').toUpperCase()}</span>}
        onClose={() => setReceiptPreviewOpen(false)}
        className="settings-receipt-preview-modal"
        focusFirstField={false}
        footer={<button type="button" onClick={() => setReceiptPreviewOpen(false)}>{t('Close')}</button>}
      >
        <div className="settings-receipt-preview-dialog-canvas">
          <div className={`settings-receipt-paper paper-${settings.receipt_paper_size || '80mm'}`}>
            {previewLoading && !receiptPreview.text
              ? <LoadingState>{t('Preparing preview...')}</LoadingState>
              : receiptPreview.html
                ? (
                  <div
                    className={receiptLayoutClassNames(receiptPreview.layout, settings.receipt_paper_size)}
                    dangerouslySetInnerHTML={{ __html: receiptPreview.html }}
                  />
                )
                : <pre>{receiptPreview.text}</pre>}
          </div>
        </div>
      </Modal>
    </section>
  );
}
