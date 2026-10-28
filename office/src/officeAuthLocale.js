const messages = {
  'Platform operations': 'ပလက်ဖောင်း စီမံခန့်ခွဲမှု',
  'Run every PwarMyar business from one place.': 'PwarMyar လုပ်ငန်းအားလုံးကို တစ်နေရာတည်းမှ စီမံပါ။',
  'Manage subscriptions, business access, plans, and renewal requests from your private Office console.': 'သီးသန့် Office မှ စာရင်းသွင်းမှု၊ လုပ်ငန်းဝင်ရောက်ခွင့်၊ အစီအစဉ်နှင့် သက်တမ်းတိုးတောင်းဆိုမှုများကို စီမံပါ။',
  'Protected access': 'လုံခြုံသော ဝင်ရောက်ခွင့်',
  'For authorized Office administrators': 'ခွင့်ပြုထားသော Office စီမံခန့်ခွဲသူများအတွက်',
  'Central control': 'ဗဟိုမှ စီမံခန့်ခွဲမှု',
  'One workspace for every tenant': 'လုပ်ငန်းအားလုံးအတွက် စီမံခန့်ခွဲရာနေရာ',
  'PwarMyar Platform Administration': 'PwarMyar ပလက်ဖောင်း စီမံခန့်ခွဲမှု',
  'Welcome back': 'ပြန်လည်ကြိုဆိုပါသည်',
  'Sign in with your Office administrator account.': 'သင်၏ Office စီမံခန့်ခွဲသူအကောင့်ဖြင့် ဝင်ပါ။',
  'Email address': 'အီးမေးလ်လိပ်စာ',
  'Password': 'စကားဝှက်',
  'Enter your password': 'သင်၏စကားဝှက်ကို ထည့်ပါ',
  'Hide password': 'စကားဝှက် ဖျောက်ရန်',
  'Show password': 'စကားဝှက် ပြရန်',
  'Keep me signed in on this device': 'ဤစက်တွင် အကောင့်ဝင်ထားမည်',
  'Signing in…': 'အကောင့်ဝင်နေသည်…',
  'Sign in to Office': 'Office သို့ ဝင်ရန်',
  'Your Office access is protected by an authenticated connection.': 'သင်၏ Office ဝင်ရောက်မှုကို လုံခြုံသော ချိတ်ဆက်မှုဖြင့် ကာကွယ်ထားပါသည်။',
};

export function officeAuthText(value, language) {
  return language === 'my' ? messages[value] || value : value;
}
