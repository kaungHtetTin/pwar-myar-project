export const LANGUAGE_STORAGE_KEY = "mkpos.language";

const MYANMAR_MODULES = {
  shop: ['ကျွန်ုပ်၏ဆိုင်', 'အွန်လိုင်းဆိုင် စီမံခန့်ခွဲရန်'],
  sell: ["အရောင်း", "အဆင့် ၃ ဆင့်ဖြင့် အမြန်ငွေရှင်းရန်"],
  products: ["ကုန်ပစ္စည်းများ", "ကုန်ပစ္စည်းလက်ကျန်နှင့် ဈေးနှုန်းများ"],
  purchases: ["အဝယ်စာရင်း", "အဝယ်စာရင်းနှင့် ကုန်ပစ္စည်းလက်ခံမှု"],
  sales: ["အရောင်း", "အရောင်းမှတ်တမ်းနှင့် ပြေစာများ"],
  suppliers: ["ပစ္စည်းသွင်းသူများ", "ပစ္စည်းသွင်းသူစာရင်း"],
  customers: ["ဖောက်သည်များ", "ဖောက်သည်စာရင်းများ"],
  expenses: ["အသုံးစရိတ်များ", "လုပ်ငန်းအသုံးစရိတ်များ"],
  transactions: ["မှတ်တမ်းများ", "ငွေပေးချေမှုမှတ်တမ်း"],
  reports: ["စာရင်းချုပ်", "လုပ်ငန်းအခြေအနေစာရင်းချုပ်"],
  billing: ["ငွေပေးသွင်းမှု", "အစီအစဉ်နှင့် ငွေပေးချေမှု"],
  settings: ["ဆက်တင်များ", "လုပ်ငန်းခွင် ဆက်တင်များ"],
  access: ["ဝင်ရောက်ခွင့်", "ဝန်ထမ်းနှင့် လုပ်ပိုင်ခွင့်များ"],
};

const MYANMAR_TEXT = {
  operations: "လုပ်ငန်းဆောင်ရွက်မှုများ",
  contacts: "အဆက်အသွယ်များ",
  finance: "ဘဏ္ဍာရေး",
  administration: "စီမံခန့်ခွဲမှု",
  workspace: "လုပ်ငန်းခွင်",
  openNavigation: "လမ်းညွှန်မီနူး ဖွင့်ရန်",
  closeNavigation: "လမ်းညွှန်မီနူး ပိတ်ရန်",
  mainNavigation: "အဓိက လမ်းညွှန်မီနူး",
  workspaceModules: "လုပ်ငန်းခွင် စာမျက်နှာများ",
  noModules: "ဤအကောင့်အတွက် အသုံးပြုခွင့်ရှိသော စာမျက်နှာ မသတ်မှတ်ရသေးပါ။",
  account: "အကောင့်",
  teamMember: "ဝန်ထမ်း",
  owner: "ပိုင်ရှင်",
  staff: "ဝန်ထမ်း",
  signOut: "ထွက်မည်",
  signingOut: "ထွက်နေပါသည်…",
};

export function normalizeLanguage(language) {
  return language === "my" ? "my" : "en";
}

export function localizeNavigationModule(module, language) {
  const translated =
    normalizeLanguage(language) === "my" ? MYANMAR_MODULES[module.id] : null;
  return translated
    ? { ...module, label: translated[0], description: translated[1] }
    : module;
}

export function navigationText(key, language, fallback = "") {
  return normalizeLanguage(language) === "my"
    ? MYANMAR_TEXT[key] || fallback
    : fallback;
}

export function localizeRole(role, language) {
  if (normalizeLanguage(language) !== "my") return role;
  const normalized = String(role || "").toLowerCase();
  if (normalized === "owner") return MYANMAR_TEXT.owner;
  if (normalized === "staff" || normalized === "team member")
    return MYANMAR_TEXT.staff;
  return role;
}
