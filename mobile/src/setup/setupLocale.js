import { BUSINESS_SETUP_MESSAGES, BUSINESS_SETUP_PATTERNS } from '../../../shared/localization/businessSetup';
import { PRODUCT_UNIT_MESSAGES, PRODUCT_UNIT_PATTERNS } from '../../../shared/localization/productUnits';

export const SETUP_MESSAGES = {
  ...BUSINESS_SETUP_MESSAGES,
  ...PRODUCT_UNIT_MESSAGES,
  'Business setup': 'လုပ်ငန်း စတင်ပြင်ဆင်ခြင်း',
  'Business name': 'လုပ်ငန်းအမည်',
  'Product name': 'ကုန်ပစ္စည်းအမည်',
  'Currency': 'ငွေကြေးယူနစ်',
  'Time zone': 'အချိန်ဇုန်',
  'Cash': 'ငွေသား',
  'Payments': 'ပေးချေမှုများ',
  'Products': 'ကုန်ပစ္စည်းများ',
  'Back': 'နောက်သို့',
  'Loading setup…': 'ပြင်ဆင်မှုအချက်အလက်များ ရယူနေသည်…',
  'Refresh setup': 'ပြင်ဆင်မှုအချက်အလက်များ ပြန်ရယူမည်',
  'Previous setup step': 'ယခင်ပြင်ဆင်မှုအဆင့်သို့ ပြန်သွားမည်',
  'Your business details and contact information.': 'လုပ်ငန်းအချက်အလက်၊ လိပ်စာနှင့် ဖုန်းနံပါတ်ကို ဖြည့်ပါ။',
};
export const SETUP_PATTERNS = [...BUSINESS_SETUP_PATTERNS, ...PRODUCT_UNIT_PATTERNS];
