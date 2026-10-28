import React from 'react';
import { Bot, Compass, ChartNoAxesCombined, ClipboardCheck, Image, ReceiptText, LifeBuoy } from 'lucide-react';
import './assistant-introduction.css';

export function AssistantIntroduction({ name, language, role }) {
  const my = language === 'my', owner = role === 'owner';
  const items = [
    [Compass, my ? 'PwarMyar အသုံးပြုနည်း' : 'Learn and navigate PwarMyar', my ? 'လုပ်ငန်းစတင်ပြင်ဆင်ခြင်း၊ ပစ္စည်းထည့်ခြင်း၊ အဝယ်နှင့် အရောင်းလုပ်နည်းကို လမ်းညွှန်ပြီး သက်ဆိုင်ရာစာမျက်နှာ ခလုတ်များ ပေးနိုင်ပါတယ်။' : 'Get setup guidance, learn products, purchases and sales, and find the right page with a link button.'],
    ...(owner ? [
      [ChartNoAxesCombined, my ? 'လုပ်ငန်းအခြေအနေနှင့် စျေးနှုန်း စစ်ဆေးခြင်း' : 'Business insights and checks', my ? 'အရောင်း၊ ကုန်ကျစရိတ်၊ ခန့်မှန်းအမြတ်၊ လက်ကျန်နှင့် စာရင်းများကို ကြည့်ရှုပြီး စျေးနှုန်းနှင့် သတ်မှတ်ချက် ပြဿနာများကို စစ်ဆေးပေးနိုင်ပါတယ်။' : 'Summarize sales, expenses, estimated profit, stock and balances, and check pricing and business setup issues.'],
      [ClipboardCheck, my ? 'ပြင်ဆင်ရန် အဆိုပြုခြင်း' : 'Prepare changes for review', my ? 'ပစ္စည်း၊ ဖောက်သည်၊ ပေးသွင်းသူ၊ အသုံးစရိတ်နှင့် ခွင့်ပြုထားသော app setting များကို မိမိအတည်ပြုရန် ဖောင်ဖြင့် အဆိုပြုပေးနိုင်ပါတယ်။' : 'Prepare supported product, contact, expense and app setting changes in a form for your review and approval.'],
    ] : []),
    [Image, my ? 'ပုံနှင့် ဖိုင်များ ဖတ်ရှုခြင်း' : 'Read images and files', my ? 'ပုံ၊ ပြေစာနှင့် screenshot များကို ဖတ်ရှုပြီး product CSV ဖိုင်ကို စစ်ဆေးပေးနိုင်ပါတယ်။ မရှင်းလင်းသည့်အချက်ကိုလည်း ပြောပြပေးပါမယ်။' : 'Read screenshots and receipts, explain visible details and check product CSV files. I’ll flag anything unclear.'],
    ...(owner ? [[ReceiptText, my ? 'PwarMyar ဝန်ဆောင်ခ တောင်းဆိုလွှာ' : 'Prepare PwarMyar billing requests', my ? 'PwarMyar သို့ ပေးချေထားသော ပြေစာကို စစ်ဆေးပြီး မိမိတင်သွင်းရန် billing ဖောင် ပြင်ဆင်ပေးနိုင်ပါတယ်။ Office မှ အတည်ပြုရပါမယ်။' : 'Check your PwarMyar payment screenshot and prepare a billing form for you to submit. Office reviews the request.']] : []),
    [LifeBuoy, my ? 'အခက်အခဲများအတွက် အကူအညီ' : 'Troubleshooting and support', my ? 'App အသုံးပြုရာတွင် အခက်အခဲများကို ကူညီဖြေရှင်းပေးနိုင်ပါတယ်။' + (owner ? ' လိုအပ်ပါက support report ပြင်ဆင်ပေးနိုင်ပါတယ်။' : '') : 'Get practical help with app problems.' + (owner ? ' If needed, I can help prepare a support report.' : '')],
  ];
  return <section className="ai-introduction" aria-label="About your AI assistant" data-no-localize>
    <header><span className="ai-introduction-avatar"><Bot size={25} aria-hidden="true"/></span><h2>{my ? `မင်္ဂလာပါ၊ ကျွန်မ ${name}ပါ။` : `Hi, I’m ${name}`}</h2><p>{my ? 'သင့်ရဲ့ PwarMyar AI အကူအညီပါ။ မြန်မာလိုဖြစ်စေ၊ အင်္ဂလိပ်လိုဖြစ်စေ မေးနိုင်ပါတယ်။' : 'Your PwarMyar AI assistant. Ask me in English or Myanmar.'}</p></header>
    <ul>{items.map(([Icon, title, description]) => <li key={title}><Icon size={18} aria-hidden="true"/><div><h3>{title}</h3><p>{description}</p></div></li>)}</ul>
    <footer><p>{owner ? (my ? 'လုပ်ငန်းဒေတာကို ပိုင်ရှင်သာ ကြည့်နိုင်ပါတယ်။ ပြောင်းလဲမှုများအတွက် မိမိအတည်ပြုချက် လိုအပ်ပါတယ်။ Password၊ လုံခြုံရေးနှင့် ဝန်ထမ်းခွင့်ပြုချက်များကို Settings တွင် ကိုယ်တိုင်ပြင်ဆင်ပါ။' : 'Business data is owner-only. Changes need your approval. Manage passwords, security and staff access yourself in Settings.') : (my ? 'မိမိခွင့်ပြုချက်ရှိသော စာမျက်နှာများကိုသာ လမ်းညွှန်ပေးနိုင်ပါတယ်။ လုပ်ငန်းဒေတာနှင့် ပြောင်းလဲမှုများအတွက် လုပ်ငန်းပိုင်ရှင်ကို ဆက်သွယ်ပါ။' : 'I can guide you to pages you have permission to use. Ask your business owner for private business data or changes.')}</p><p className="ai-introduction-example">{my ? 'စမေးကြည့်ပါ — ' : 'Try asking: ' }<q>{owner ? (my ? 'ကျွန်မလုပ်ငန်း စတင်ပြင်ဆင်ဖို့ ကူညီပေးပါ' : 'Help me set up my business') : (my ? 'PwarMyar မှာ အရောင်းလုပ်နည်း ပြောပြပါ' : 'How do I make a sale in PwarMyar?')}</q></p></footer>
  </section>;
}
