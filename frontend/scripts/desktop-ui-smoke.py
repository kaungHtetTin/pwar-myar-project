"""Read-only desktop layout smoke checks using synthetic API responses.

Requires Selenium and an installed Chrome. No business records or cookies used.
Run with the existing Vite server: python scripts/desktop-ui-smoke.py
"""
import json
from pathlib import Path
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'test-artifacts' / 'desktop-ui'
OUT.mkdir(parents=True, exist_ok=True)
options = webdriver.ChromeOptions()
options.add_argument('--headless=new')
options.add_argument('--window-size=1440,1000')
options.set_capability('goog:loggingPrefs', {'browser': 'ALL'})
driver = webdriver.Chrome(options=options)
wait = WebDriverWait(driver, 20)
fixture = r"""
localStorage.setItem('mkpos.activeModule', 'products');
const nativeFetch = window.fetch;
const ids = ['sell','products','purchases','suppliers','customers','expenses','transactions','reports','billing','settings','access'];
const subscription = {is_valid:true,access_type:'trial',ends_at:'2026-10-17',days_remaining:28,lifecycle_notice:{title:'Your free trial is active',stage:'active'}};
const customer = {id:1,name:'Sample Customer',phone:'09 123 456 789',address:'Sample business address',balance:9850,note:'Synthetic UI test account'};
const products = Array.from({length:12},(_,i)=>({id:i+1,name:['Arabica Coffee','Green Tea','Oat Milk','Brown Rice'][i%4]+' '+(i+1),category:'Groceries',barcode:'900000'+i,stock:45+i,price:3500,cost:2000,unit:'pcs',prices:[{name:'Retail',price:3500},{name:'Wholesale',price:3200,is_manual:false}]}));
window.fetch = async (input, options={}) => {
 const url = new URL(typeof input==='string'?input:input.url, location.href);
 if(!url.pathname.includes('/api/')&&!url.pathname.includes('/sanctum/')) return nativeFetch(input,options);
 const path=url.pathname.split('/api')[1]||url.pathname;
 let data={items:[],total:0,summary:{},methods:[],categories:[]};
 if(path==='/auth/me') data={user:{id:1,name:'Demo Owner',email:'demo@example.test',role:'owner'},business:{id:1,name:'Sample Store'},permissions:ids,subscription};
 else if(path==='/app-config') data={enabled_modules:ids};
 else if(path==='/settings') data={shop_name:'Sample Store',shop_phone:'09 123 456 789',shop_address:'Sample business address',payment_methods:'Cash,KBZPay',price_types:'Retail,Wholesale,Credit',currency:'Ks',language:'en'};
 else if(path==='/categories') data=['Groceries','Beverages'];
 else if(path==='/price-types') data={items:['Retail','Wholesale','Credit'],rules:[],usage:{}};
 else if(path==='/products/summary') data={total_products:12,total_stock_units:606,low_stock:0,out_of_stock:0};
 else if(path==='/products') data=url.searchParams.has('with_total')?{items:products,total:12}:products;
 else if(path==='/customers') data={items:[customer],total:1,account_summary:{total_customers:1,receivable_total:9850,payable_total:0,open_accounts:1}};
 else if(path==='/expenses') data=[];
 else if(path==='/customers/1/detail') data={customer,summary:{balance:9850,credit_total:9850,paid_total:0,payout_total:0},history:{sales_count:12,payment_count:0}};
 else if(path==='/customers/1/sales') data={items:Array.from({length:12},(_,i)=>({id:i+1,created_at:'2026-09-19 10:00:00',receipt_number:'R260919-'+(i+1),total:3500,paid_amount:0,credit_amount:3500})),total:12};
 else if(path==='/reports/summary') data={start:'2026-09-01',end:'2026-09-19',sales_total:42000,cash_total:30000,credit_total:12000,expense_total:5000,purchase_total:18000,profit_estimate:19000,sales_count:12,payment_methods:[],expense_categories:[],top_products:[]};
 else if(path==='/subscription') data=subscription;
 if((options.method||'GET').toUpperCase()!=='GET') throw new Error('UI fixture blocks writes');
 return new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json'}});
};
"""
try:
    driver.execute_cdp_cmd('Emulation.setDeviceMetricsOverride', {'width':1440,'height':900,'deviceScaleFactor':1,'mobile':False})
    driver.execute_cdp_cmd('Page.addScriptToEvaluateOnNewDocument', {'source': fixture})
    driver.get('http://127.0.0.1:5174/')
    wait.until(lambda d: d.find_elements(By.CSS_SELECTOR, '.workspace-header'))
    results = []
    for label in ['Products','Customers','Purchases','New Purchase','Suppliers','Expenses','Transactions','Reports','Billing','Settings','Access','Sell']:
        if label == 'New Purchase':
            driver.find_element(By.CSS_SELECTOR, '.workspace-app-bar-actions button.primary').click()
        else:
            driver.find_element(By.CSS_SELECTOR, f'.sidebar nav button[title="{label}"]').click()
        wait.until(lambda d: d.find_element(By.CSS_SELECTOR, '.workspace-page-heading h1').text == label)
        wait.until(lambda d: not d.find_elements(By.CSS_SELECTOR, '.module-view:not([hidden]) .table-loading-state'))
        if label == 'Sell':
            wait.until(lambda d: d.find_elements(By.CSS_SELECTOR, '.sale-product-card'))
        driver.execute_script('window.scrollTo(0,0)')
        driver.save_screenshot(str(OUT / (label.lower().replace(' ','-')+'.png')))
        metrics = driver.execute_script("""return {page:document.querySelector('.workspace-page-heading h1').textContent,width:innerWidth,docWidth:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,bodyOverflow:getComputedStyle(document.body).overflowY,rootCount:document.querySelectorAll('.module-view:not([hidden])').length};""")
        results.append(metrics)
        assert metrics['docWidth'] <= metrics['width'], metrics
        assert metrics['rootCount'] == 1, metrics
        authored_inline_styles = driver.execute_script("""return [...document.querySelectorAll('.desktop-workspace [style]')].filter((element) => !element.closest('.recharts-responsive-container, .recharts-wrapper')).length;""")
        assert authored_inline_styles == 0, f'{label} rendered authored inline style attributes'
        action_widths = driver.execute_script("""return [...document.querySelectorAll('.module-view:not([hidden]) table th:last-child')].filter((cell) => cell.textContent.trim() === 'Actions').map((cell) => cell.getBoundingClientRect().width);""")
        metrics['actionWidths'] = action_widths
        assert all(79.5 <= width <= 80.5 for width in action_widths), f'{label} action column widths: {action_widths}'
        table_body_font_sizes = driver.execute_script("""return [...new Set([...document.querySelectorAll('.module-view:not([hidden]) table:not(.receipt-table) tbody td, .module-view:not([hidden]) table:not(.receipt-table) tbody td *')].filter((element) => element.offsetParent !== null && element.textContent.trim()).map((element) => getComputedStyle(element).fontSize))];""")
        metrics['tableBodyFontSizes'] = table_body_font_sizes
        assert all(size == '12px' for size in table_body_font_sizes), f'{label} table body font sizes: {table_body_font_sizes}'
        status_typography = driver.execute_script("""return [...document.querySelectorAll('.module-view:not([hidden]) table:not(.receipt-table) tbody :is(.status-badge, .status-pill, .access-status, .desktop-sale-status, .transaction-type-badge, .transaction-direction-badge, .billing-paid-badge)')].filter((element) => element.offsetParent !== null).map((element) => { const style=getComputedStyle(element); return {fontSize:style.fontSize,fontWeight:style.fontWeight,minHeight:style.minHeight,paddingTop:style.paddingTop,paddingRight:style.paddingRight,borderRadius:style.borderRadius}; });""")
        metrics['statusTypography'] = status_typography
        assert all(item == {'fontSize':'12px','fontWeight':'800','minHeight':'24px','paddingTop':'2px','paddingRight':'8px','borderRadius':'999px'} for item in status_typography), f'{label} status typography: {status_typography}'
        if label == 'Access':
            access_panel_widths = driver.execute_script("""return [...document.querySelectorAll('.module-view:not([hidden]) .access-panel')].map((panel) => panel.getBoundingClientRect().width);""")
            metrics['accessPanelWidths'] = access_panel_widths
            assert len(access_panel_widths) == 2 and all(width >= 400 for width in access_panel_widths), f'Access table panels collapsed: {access_panel_widths}'
        app_bar_weights = driver.execute_script("""return [...new Set([...document.querySelectorAll('.workspace-app-bar-actions button')].filter((button) => button.offsetParent !== null).map((button) => getComputedStyle(button).fontWeight))];""")
        assert app_bar_weights in ([], ['600']), f'{label} app bar font weights: {app_bar_weights}'
        if label == 'Products':
            assert driver.execute_script("return Math.abs(document.querySelector('.product-data-table th:nth-child(4)').getBoundingClientRect().width - 260) < .5"), 'Product Prices column is not 260px'
            assert driver.execute_script("return [...document.querySelectorAll('.product-price-row em')].every((element) => element.scrollWidth <= element.clientWidth)"), 'Product price labels are clipped'
            driver.execute_script('window.scrollTo(0, document.documentElement.scrollHeight)')
            header_position = driver.execute_script("const el=document.querySelector('.workspace-header'); return {position:getComputedStyle(el).position,top:el.getBoundingClientRect().top};")
            assert header_position['position'] == 'sticky' and abs(header_position['top']) < 1, header_position
    # All desktop target sizes, including short laptop viewports.
    for width, height in [(1366,768),(1536,864),(1920,1080)]:
        driver.execute_cdp_cmd('Emulation.setDeviceMetricsOverride', {'width':width,'height':height,'deviceScaleFactor':1,'mobile':False})
        for label in ['Products','Customers','Purchases','New Purchase','Suppliers','Expenses','Transactions','Reports','Billing','Settings','Access','Sell']:
            if label == 'New Purchase':
                driver.find_element(By.CSS_SELECTOR, '.sidebar nav button[title="Purchases"]').click()
                wait.until(lambda d: d.find_element(By.CSS_SELECTOR, '.workspace-page-heading h1').text == 'Purchases')
                driver.find_element(By.CSS_SELECTOR, '.workspace-app-bar-actions button.primary').click()
            else:
                driver.find_element(By.CSS_SELECTOR, f'.sidebar nav button[title="{label}"]').click()
            wait.until(lambda d: d.find_element(By.CSS_SELECTOR, '.workspace-page-heading h1').text == label)
            assert driver.execute_script('return document.documentElement.scrollWidth <= innerWidth'), (label,width)
    driver.execute_cdp_cmd('Emulation.setDeviceMetricsOverride', {'width':1366,'height':768,'deviceScaleFactor':1,'mobile':False})
    driver.find_element(By.CSS_SELECTOR, '.sidebar nav button[title="Customers"]').click()
    customer_action = driver.find_element(By.CSS_SELECTOR, 'button[aria-label="Actions for Sample Customer"]')
    customer_action.click()
    action_menu = driver.find_element(By.CSS_SELECTOR, '.row-actions-menu')
    action_position = driver.execute_script("const trigger=arguments[0].getBoundingClientRect(),menu=arguments[1].getBoundingClientRect(); return {rightGap:Math.abs(trigger.right-menu.right),topGap:Math.abs((trigger.bottom+4)-menu.top)};", customer_action, action_menu)
    assert action_position['rightGap'] < 3 and action_position['topGap'] < 3, action_position
    driver.find_element(By.CSS_SELECTOR, '.row-actions-menu button').click()
    wait.until(lambda d: d.find_elements(By.CSS_SELECTOR, '.customer-account-overview'))
    driver.execute_script('window.scrollTo(0,document.documentElement.scrollHeight)')
    footer = driver.find_elements(By.CSS_SELECTOR, '.customer-history-list-footer')[-1]
    assert driver.execute_script('return arguments[0].getBoundingClientRect().bottom <= innerHeight', footer), 'Customer footer unreachable'
    driver.save_screenshot(str(OUT / 'customer-account-bottom-1366.png'))
    driver.find_element(By.CSS_SELECTOR, '.sidebar nav button[title="Products"]').click()
    driver.execute_script('window.scrollTo(0,0)')
    driver.find_element(By.CSS_SELECTOR, '.workspace-app-bar-actions .filter-drawer-trigger').click()
    wait.until(lambda d: d.find_elements(By.CSS_SELECTOR, '.mkpos-filter-drawer'))
    driver.save_screenshot(str(OUT / 'product-filters-1366.png'))
    driver.find_element(By.CSS_SELECTOR, '.mkpos-filter-drawer-header button').click()
    driver.find_element(By.CSS_SELECTOR, '.workspace-app-bar-actions .primary').click()
    wait.until(lambda d: d.find_elements(By.CSS_SELECTOR, '.mkpos-modal'))
    driver.save_screenshot(str(OUT / 'product-form-1366.png'))
    driver.find_element(By.CSS_SELECTOR, '.mkpos-modal-header button').click()
    driver.find_element(By.CSS_SELECTOR, '.workspace-menu-button').click()
    assert driver.find_elements(By.CSS_SELECTOR, '.sidebar-collapsed'), 'Sidebar did not collapse'
    assert len(driver.find_elements(By.CSS_SELECTOR, '.workspace-header button')) > 1, 'Active page actions were not mounted in the app bar'
    app_bar_text = driver.find_element(By.CSS_SELECTOR, '.workspace-app-bar-actions').text
    assert 'Add Product' in app_bar_text and 'Filters' in app_bar_text and 'Import' in app_bar_text, app_bar_text
    assert not driver.find_elements(By.CSS_SELECTOR, '.workspace-search, .workspace-identity'), 'Removed app bar controls are still visible'
    driver.save_screenshot(str(OUT / 'products-app-bar-collapsed-1366.png'))
    driver.execute_cdp_cmd('Emulation.setDeviceMetricsOverride', {'width':1024,'height':768,'deviceScaleFactor':1,'mobile':False})
    search_input = driver.find_element(By.CSS_SELECTOR, '.workspace-app-bar-search input')
    collapsed_search_width = driver.find_element(By.CSS_SELECTOR, '.workspace-app-bar-search').rect['width']
    expanded_action_width = driver.find_element(By.CSS_SELECTOR, '.workspace-app-bar-action-group > button').rect['width']
    search_input.click()
    wait.until(lambda d: d.find_element(By.CSS_SELECTOR, '.workspace-app-bar-search').rect['width'] > 200)
    wait.until(lambda d: d.find_element(By.CSS_SELECTOR, '.workspace-app-bar-action-group > button').rect['width'] <= 32)
    assert collapsed_search_width <= 34 and expanded_action_width > 32, (collapsed_search_width, expanded_action_width)
    driver.save_screenshot(str(OUT / 'products-search-expanded-1024.png'))
    print('Passed: 48 module/viewport layouts, customer footer reachability, filter drawer, product modal, sidebar collapse, dynamic app bar actions.')
    print(json.dumps(results, indent=2))
    print('Browser errors:', json.dumps([x['message'] for x in driver.get_log('browser') if x['level']=='SEVERE'], indent=2))
finally:
    print('Final browser errors:', json.dumps([x['message'] for x in driver.get_log('browser') if x['level']=='SEVERE'], indent=2))
    driver.quit()
