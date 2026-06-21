
    const STORAGE_KEY = 'so_doanh_thu_hkd_v1';
    const todayISO = () => new Date().toISOString().slice(0,10);
    const id = () => Date.now().toString(36) + Math.random().toString(36).slice(2,7);
    const currency = (n) => new Intl.NumberFormat('vi-VN',{style:'currency',currency:'VND',maximumFractionDigits:0}).format(Number(n||0));
    const number = (n) => new Intl.NumberFormat('vi-VN').format(Number(n||0));
    const escapeHtml = (s='') => String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

    const defaultData = {
      settings: {
        businessName: 'Hộ kinh doanh: ................................',
        address: '................................',
        taxCode: '................................',
        businessLocation: '................................',
        ownerName: '................................',
        unit: 'đồng'
      },
      products: [
        {id:id(), name:'Vé Sun World người lớn', category:'Vé khu vui chơi', supplierId:'', publicPrice:800000, defaultCost:690000, ctvPrice:720000, defaultPrice:750000, unit:'vé', note:''},
        {id:id(), name:'Vé VinWonders trẻ em', category:'Vé khu vui chơi', supplierId:'', publicPrice:600000, defaultCost:450000, ctvPrice:490000, defaultPrice:520000, unit:'vé', note:''},
        {id:id(), name:'Vé show giải trí', category:'Vé show', supplierId:'', defaultCost:300000, defaultPrice:360000, unit:'vé'}
      ],
      customers: [],
      suppliers: [],
      orders: [],
      expenses: [],
      backupNote: 'Dữ liệu lưu trong trình duyệt trên máy này. Hãy sao lưu JSON định kỳ.'
    };

    let db = loadData();
    let activeSection = 'dashboard';
    let reportRange = {from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0,10), to: todayISO()};

    function isTauriRuntime(){
      return !!(window.__TAURI__ && window.__TAURI__.core && typeof window.__TAURI__.core.invoke === 'function');
    }
    async function tauriInvoke(command, payload){
      if(!isTauriRuntime()) throw new Error('Không chạy trong Tauri');
      return window.__TAURI__.core.invoke(command, payload || {});
    }
    function mergeData(data){
      const base = structuredClone(defaultData);
      const merged = {...base, ...(data || {})};
      merged.settings = {...base.settings, ...((data && data.settings) || {})};
      merged.products = Array.isArray(merged.products) ? merged.products : [];
      merged.customers = Array.isArray(merged.customers) ? merged.customers : [];
      merged.suppliers = Array.isArray(merged.suppliers) ? merged.suppliers : [];
      merged.orders = Array.isArray(merged.orders) ? merged.orders : [];
      merged.expenses = Array.isArray(merged.expenses) ? merged.expenses : [];
      return merged;
    }
    function loadData(){
      const raw = localStorage.getItem(STORAGE_KEY);
      if(!raw){ localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultData)); return structuredClone(defaultData); }
      try { return mergeData(JSON.parse(raw)); } catch { return structuredClone(defaultData); }
    }
    async function loadDataFromSQLite(){
      if(!isTauriRuntime()) return;
      try{
        const raw = await tauriInvoke('get_app_data');
        if(raw){
          db = mergeData(JSON.parse(raw));
          localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
          render();
          return;
        }
        const localRaw = localStorage.getItem(STORAGE_KEY);
        if(localRaw){
          await tauriInvoke('save_app_data', { payload: localRaw });
        }
      }catch(error){
        console.error('Không tải được dữ liệu SQLite:', error);
        alert('Không tải được dữ liệu từ SQLite. Phần mềm sẽ tạm dùng dữ liệu trình duyệt. Chi tiết: ' + (error && error.message ? error.message : error));
      }
    }
    function saveData(){
      const payload = JSON.stringify(db);
      localStorage.setItem(STORAGE_KEY, payload);
      if(isTauriRuntime()){
        tauriInvoke('save_app_data', { payload }).catch(error=>{
          console.error('Không lưu được SQLite:', error);
          alert('Không lưu được dữ liệu vào SQLite. Hãy thử đóng mở lại phần mềm. Chi tiết: ' + (error && error.message ? error.message : error));
        });
      }
      render();
    }
    function showToast(msg){ alert(msg); }

    const sections = [
      ['dashboard','Tổng quan','Theo dõi nhanh doanh thu, lợi nhuận, công nợ.'],
      ['orders','Đơn hàng','Nhập đơn bán vé, show, tour, combo.'],
      ['products','Sản phẩm/Vé','Danh mục vé, show, tour, combo.'],
      ['customers','Khách hàng','Thông tin khách và công nợ.'],
      ['suppliers','Nhà cung cấp','Đối tác cung cấp vé/dịch vụ.'],
      ['expenses','Chi phí','Quảng cáo, hoàn hủy, phí chuyển khoản.'],
      ['report','Báo cáo','Báo cáo doanh thu, lợi nhuận, công nợ.'],
      ['reportS1a','Mẫu S1a-HKD','Sổ doanh thu bán hàng hóa, dịch vụ.'],
      ['settings','Cài đặt & Sao lưu','Thông tin HKD, sao lưu, khôi phục.']
    ];

    function initNav(){
      document.getElementById('nav').innerHTML = sections.map(([key,title]) => `<button id="nav-${key}" onclick="showSection('${key}')">${title}</button>`).join('');
    }
    function showSection(key){ activeSection = key; render(); }
    function setTitle(){
      const sec = sections.find(s=>s[0]===activeSection) || sections[0];
      document.getElementById('pageTitle').textContent = sec[1];
      document.getElementById('pageDesc').textContent = sec[2];
      sections.forEach(([key])=>document.getElementById('nav-'+key)?.classList.toggle('active',key===activeSection));
      document.querySelectorAll('.section').forEach(el=>el.classList.remove('active'));
      document.getElementById(activeSection+'-section')?.classList.add('active');
    }

    function getCustomer(id){ return db.customers.find(x=>x.id===id); }
    function getSupplier(id){ return db.suppliers.find(x=>x.id===id); }
    function getProduct(id){ return db.products.find(x=>x.id===id); }
    function normalizeOrderItems(order){
      if(order && Array.isArray(order.items) && order.items.length){
        return order.items.map(item => ({
          id: item.id || id(),
          productId: item.productId || '',
          productName: item.productName || '',
          quantity: Number(item.quantity || 1),
          costPrice: Number(item.costPrice || 0),
          salePrice: Number(item.salePrice || 0),
          discount: Number(item.discount || 0),
          note: item.note || ''
        }));
      }
      if(order && (order.productName || order.productId)){
        return [{
          id: id(),
          productId: order.productId || '',
          productName: order.productName || '',
          quantity: Number(order.quantity || 1),
          costPrice: Number(order.costPrice || 0),
          salePrice: Number(order.salePrice || 0),
          discount: Number(order.discount || 0),
          note: ''
        }];
      }
      return [];
    }
    function getOrderProductSummary(order){
      const items = normalizeOrderItems(order);
      if(!items.length) return 'Chưa có sản phẩm';
      const names = items.map(item => `${item.productName || 'Sản phẩm'} x${Number(item.quantity || 0)}`);
      return names.length > 3 ? names.slice(0,3).join(', ') + ` +${names.length - 3} sản phẩm khác` : names.join(', ');
    }
    function getOrderTotals(order){
      const items = normalizeOrderItems(order);
      const lineTotals = items.reduce((sum,item)=>{
        const qty = Number(item.quantity||0);
        const sale = Number(item.salePrice||0);
        const cost = Number(item.costPrice||0);
        const itemDiscount = Number(item.discount||0);
        sum.revenue += Math.max(0, qty * sale - itemDiscount);
        sum.totalCost += Math.max(0, qty * cost);
        sum.quantity += qty;
        return sum;
      }, {revenue:0,totalCost:0,quantity:0});
      const orderDiscount = Array.isArray(order.items) ? Number(order.discount||0) : 0;
      const surcharge = Number(order.surcharge||0);
      const paid = Number(order.paid||0);
      const revenue = Math.max(0, lineTotals.revenue - orderDiscount + surcharge);
      const totalCost = lineTotals.totalCost;
      const profit = revenue - totalCost;
      const debt = revenue - paid;
      return {revenue,totalCost,profit,debt,paid,quantity:lineTotals.quantity};
    }
    function filteredOrders(){ return db.orders.filter(o => (!reportRange.from || o.orderDate>=reportRange.from) && (!reportRange.to || o.orderDate<=reportRange.to) && o.status!=='cancelled'); }
    function filteredExpenses(){ return db.expenses.filter(e => (!reportRange.from || e.date>=reportRange.from) && (!reportRange.to || e.date<=reportRange.to)); }
    function getSummary(orders=filteredOrders(), expenses=filteredExpenses()){
      const sums = orders.reduce((a,o)=>{const t=getOrderTotals(o);a.revenue+=t.revenue;a.cost+=t.totalCost;a.profit+=t.profit;a.paid+=t.paid;a.debt+=Math.max(0,t.debt);a.count++;return a;},{revenue:0,cost:0,profit:0,paid:0,debt:0,count:0});
      const exp = expenses.reduce((s,e)=>s+Number(e.amount||0),0);
      sums.expenses = exp; sums.netProfit = sums.profit - exp; return sums;
    }

    function renderDashboard(){
      const todayOrders = db.orders.filter(o=>o.orderDate===todayISO() && o.status!=='cancelled');
      const todayExpenses = db.expenses.filter(e=>e.date===todayISO());
      const today = getSummary(todayOrders,todayExpenses);
      const month = getSummary();
      const recent = [...db.orders].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,5);
      document.getElementById('dashboard-section').innerHTML = `
        <div class="grid kpi">
          <div class="card kpi-card"><div class="kpi-label">Doanh thu hôm nay</div><div class="kpi-value">${currency(today.revenue)}</div><div class="kpi-sub">${today.count} đơn</div></div>
          <div class="card kpi-card"><div class="kpi-label">Lãi gộp hôm nay</div><div class="kpi-value">${currency(today.profit)}</div><div class="kpi-sub">Chưa trừ toàn bộ chi phí tháng</div></div>
          <div class="card kpi-card"><div class="kpi-label">Doanh thu kỳ đang chọn</div><div class="kpi-value">${currency(month.revenue)}</div><div class="kpi-sub">${reportRange.from} đến ${reportRange.to}</div></div>
          <div class="card kpi-card"><div class="kpi-label">Lợi nhuận thực</div><div class="kpi-value">${currency(month.netProfit)}</div><div class="kpi-sub">Lãi gộp - chi phí</div></div>
        </div>
        <div class="dashboard-main-row">
          <div class="card dashboard-recent-card"><h3>Đơn gần đây</h3>${ordersTable(recent, false)}</div>
          <div class="card dashboard-actions-card"><h3>Việc nên làm</h3><div class="grid">
            <button class="btn primary" onclick="openOrderModal()">+ Nhập đơn bán vé</button>
            <button class="btn" onclick="showSection('products')">Thêm sản phẩm/vé</button>
            <button class="btn green" onclick="showSection('reportS1a')">Xuất sổ S1a-HKD</button>
            <button class="btn orange" onclick="downloadBackup()">Sao lưu dữ liệu</button>
          </div><p class="hint">Mẹo: cuối ngày nên bấm sao lưu dữ liệu một lần.</p></div>
        </div>`;
    }

    function ordersTable(rows=db.orders, showActions=true){
      if(!rows.length) return `<div class="empty">Chưa có đơn hàng.</div>`;
      return `<div class="table-wrap"><table class="orders-table ${showActions ? 'orders-table-actions' : 'orders-table-compact'}"><thead><tr>${showActions?`<th class="select-col">${selectAllCheckbox('orders')}</th>`:''}<th>Ngày</th><th>Mã đơn</th><th>Khách</th><th>Sản phẩm trong đơn</th><th class="money">SL</th><th class="money">Doanh thu</th><th class="money">Giá vốn</th><th class="money">Lãi</th><th>TT</th>${showActions?'<th></th>':''}</tr></thead><tbody>${rows.map(o=>{const t=getOrderTotals(o);const c=getCustomer(o.customerId);return `<tr>${showActions?`<td class="select-cell">${rowCheckbox('orders', o.id)}</td>`:''}<td>${o.orderDate}<br><span class="small">Dùng: ${o.usageDate||'-'}</span></td><td><b>${escapeHtml(o.code)}</b></td><td>${escapeHtml(c?.name||o.customerName||'Khách lẻ')}<br><span class="small">${escapeHtml(c?.phone||'')}</span></td><td>${escapeHtml(getOrderProductSummary(o))}</td><td class="money">${number(t.quantity)}</td><td class="money">${currency(t.revenue)}</td><td class="money">${currency(t.totalCost)}</td><td class="money"><b>${currency(t.profit)}</b></td><td>${paymentBadge(o,t)}</td>${showActions?`<td><button class="btn gray" onclick="editOrder('${o.id}')">Sửa</button> <button class="btn red" onclick="deleteOrder('${o.id}')">Xóa</button></td>`:''}</tr>`}).join('')}</tbody></table></div>`;
    }
    function paymentBadge(o,t){ if(o.status==='cancelled') return '<span class="status cancelled">Đã hủy</span>'; if(t.paid>=t.revenue) return '<span class="status paid">Đã thu đủ</span>'; if(t.paid>0) return '<span class="status partial">Thu một phần</span>'; return '<span class="status unpaid">Chưa thu</span>'; }

    function renderOrders(){
      document.getElementById('orders-section').innerHTML = `<div class="card"><div class="toolbar"><button class="btn primary" onclick="openOrderModal()">+ Tạo đơn</button><button class="btn" onclick="exportOrdersCsv()">Xuất CSV đơn hàng</button></div>${ordersTable([...db.orders].sort((a,b)=>b.orderDate.localeCompare(a.orderDate)))}</div>`;
    }

    function renderProducts(){
      const categories = [...new Set(db.products.map(p=>p.category).filter(Boolean))];
      document.getElementById('products-section').innerHTML = `<div class="card"><div class="toolbar"><button class="btn primary" onclick="openProductModal()">+ Thêm sản phẩm/vé</button><button class="btn green" onclick="document.getElementById('productExcelFile').click()">Nhập từ Excel</button><button class="btn" onclick="downloadProductTemplateCsv()">Tải file mẫu CSV</button><input id="productExcelFile" type="file" accept=".xlsx,.csv" style="display:none" onchange="importProductsFromFile(event)"></div><div class="import-box"><b>Nhập sản phẩm từ Excel:</b> mỗi sheet/bảng tính sẽ được hiểu là một <b>danh mục</b>. Dòng tiêu đề cần có các cột: <b>LOẠI VÉ, GIÁ CÔNG BỐ, GIÁ NHẬP, CTV, GIÁ BÁN, GHI CHÚ</b>.<div class="hint">Với Google Sheet bạn gửi: vào Tệp → Tải xuống → Microsoft Excel (.xlsx), sau đó bấm "Nhập từ Excel". Nếu Google Sheet để công khai, bạn cũng có thể xuất ra .xlsx rồi nhập vào phần mềm.</div><div id="importResult"></div></div><div class="hint" style="margin-bottom:10px">Danh mục hiện có: ${categories.length ? categories.map(c=>`<span class="badge">${escapeHtml(c)}</span>`).join(' ') : 'Chưa có'}</div>${db.products.length?`<div class="table-wrap"><table class="product-table"><thead><tr><th>Loại vé</th><th>Danh mục</th><th class="money">Giá công bố</th><th class="money">Giá nhập</th><th class="money">CTV</th><th class="money">Giá bán</th><th>Ghi chú</th><th></th></tr></thead><tbody>${db.products.map(p=>`<tr><td><b>${escapeHtml(p.name)}</b></td><td>${escapeHtml(p.category||'')}</td><td class="money">${currency(p.publicPrice)}</td><td class="money">${currency(p.defaultCost)}</td><td class="money">${currency(p.ctvPrice)}</td><td class="money">${currency(p.defaultPrice)}</td><td>${escapeHtml(p.note||'')}</td><td><button class="btn gray" onclick="openProductModal('${p.id}')">Sửa</button> <button class="btn red" onclick="deleteItem('products','${p.id}')">Xóa</button></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">Chưa có sản phẩm.</div>'}</div>`;
    }
    function renderCustomers(){
      document.getElementById('customers-section').innerHTML = `<div class="card"><div class="toolbar"><button class="btn primary" onclick="openCustomerModal()">+ Thêm khách hàng</button></div>${db.customers.length?`<div class="table-wrap"><table class="customers-table"><thead><tr><th>Tên</th><th>SĐT</th><th>Nguồn</th><th class="money">Tổng mua</th><th class="money">Còn nợ</th><th></th></tr></thead><tbody>${db.customers.map(c=>{const orders=db.orders.filter(o=>o.customerId===c.id&&o.status!=='cancelled');const s=getSummary(orders,[]);return `<tr><td><b>${escapeHtml(c.name)}</b></td><td>${escapeHtml(c.phone||'')}</td><td>${escapeHtml(c.source||'')}</td><td class="money">${currency(s.revenue)}</td><td class="money">${currency(s.debt)}</td><td><button class="btn gray" onclick="openCustomerModal('${c.id}')">Sửa</button> <button class="btn red" onclick="deleteItem('customers','${c.id}')">Xóa</button></td></tr>`}).join('')}</tbody></table></div>`:'<div class="empty">Chưa có khách hàng.</div>'}</div>`;
    }
    function renderSuppliers(){
      document.getElementById('suppliers-section').innerHTML = `<div class="card"><div class="toolbar"><button class="btn primary" onclick="openSupplierModal()">+ Thêm nhà cung cấp</button></div>${db.suppliers.length?`<div class="table-wrap"><table class="suppliers-table"><thead><tr><th>Tên</th><th>Liên hệ</th><th>SĐT</th><th>Ghi chú</th><th></th></tr></thead><tbody>${db.suppliers.map(s=>`<tr><td><b>${escapeHtml(s.name)}</b></td><td>${escapeHtml(s.contact||'')}</td><td>${escapeHtml(s.phone||'')}</td><td>${escapeHtml(s.note||'')}</td><td><button class="btn gray" onclick="openSupplierModal('${s.id}')">Sửa</button> <button class="btn red" onclick="deleteItem('suppliers','${s.id}')">Xóa</button></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">Chưa có nhà cung cấp.</div>'}</div>`;
    }
    function renderExpenses(){
      document.getElementById('expenses-section').innerHTML = `<div class="card"><div class="toolbar"><button class="btn primary" onclick="openExpenseModal()">+ Thêm chi phí</button></div>${db.expenses.length?`${bulkDeleteBar('expenses','chi phí')}<div class="table-wrap"><table class="expenses-table"><thead><tr><th class="select-col">${selectAllCheckbox('expenses')}</th><th>Ngày</th><th>Nhóm</th><th>Nội dung</th><th class="money">Số tiền</th><th></th></tr></thead><tbody>${db.expenses.sort((a,b)=>b.date.localeCompare(a.date)).map(e=>`<tr><td class="select-cell">${rowCheckbox('expenses', e.id)}</td><td>${e.date}</td><td>${escapeHtml(e.category)}</td><td>${escapeHtml(e.description||'')}</td><td class="money">${currency(e.amount)}</td><td><button class="btn gray" onclick="openExpenseModal('${e.id}')">Sửa</button> <button class="btn red" onclick="deleteItem('expenses','${e.id}')">Xóa</button></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">Chưa có chi phí.</div>'}</div>`;
    }

    function dateToolbar(){return `<div class="toolbar no-print"><div class="field"><label>Từ ngày</label><input type="date" value="${reportRange.from}" onchange="reportRange.from=this.value;render()"></div><div class="field"><label>Đến ngày</label><input type="date" value="${reportRange.to}" onchange="reportRange.to=this.value;render()"></div></div>`;}
    function renderReport(){
      const orders=filteredOrders(), expenses=filteredExpenses(), s=getSummary(orders,expenses);
      document.getElementById('report-section').innerHTML = `${dateToolbar()}<div class="grid kpi"><div class="card kpi-card"><div class="kpi-label">Doanh thu</div><div class="kpi-value">${currency(s.revenue)}</div></div><div class="card kpi-card"><div class="kpi-label">Giá vốn</div><div class="kpi-value">${currency(s.cost)}</div></div><div class="card kpi-card"><div class="kpi-label">Chi phí</div><div class="kpi-value">${currency(s.expenses)}</div></div><div class="card kpi-card"><div class="kpi-label">Lợi nhuận thực</div><div class="kpi-value">${currency(s.netProfit)}</div></div></div><div class="card"><div class="toolbar"><button class="btn" onclick="exportReportCsv()">Xuất CSV báo cáo</button></div>${ordersTable(orders)}</div>`;
    }
    function s1aRows(){
      const grouped = new Map();
      filteredOrders().forEach(o=>{
        const t=getOrderTotals(o);
        const desc = `Doanh thu đơn ${o.code || ''}: ${getOrderProductSummary(o)}`;
        const key=o.orderDate+'|'+desc;
        const cur=grouped.get(key)||{date:o.orderDate,desc,amount:0};
        cur.amount+=t.revenue;
        grouped.set(key,cur);
      });
      return [...grouped.values()].sort((a,b)=>a.date.localeCompare(b.date));
    }
    function s1aHtml(){
      const rows=s1aRows(); const total=rows.reduce((s,r)=>s+r.amount,0); const st=db.settings;
      return `<div class="s1a-paper"><div class="s1a-top"><div><b>HỘ, CÁ NHÂN KINH DOANH:</b> ${escapeHtml(st.businessName)}<br><b>Địa chỉ:</b> ${escapeHtml(st.address)}<br><b>Mã số thuế:</b> ${escapeHtml(st.taxCode)}</div><div><b>Mẫu số S1a-HKD</b><br><span class="small">Kèm theo Thông tư 152/2025/TT-BTC</span></div></div><div class="s1a-title"><h2>SỔ DOANH THU BÁN HÀNG HÓA, DỊCH VỤ</h2><div><b>Địa điểm kinh doanh:</b> ${escapeHtml(st.businessLocation)}</div><div><b>Kỳ kê khai:</b> ${reportRange.from} đến ${reportRange.to} &nbsp;&nbsp; <b>Đơn vị tính:</b> ${escapeHtml(st.unit||'đồng')}</div></div><table class="s1a-table"><thead><tr><th style="width:130px">Ngày tháng</th><th>Diễn giải</th><th style="width:180px">Số tiền</th></tr><tr><th>A</th><th>B</th><th>1</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${r.date}</td><td>${escapeHtml(r.desc)}</td><td class="money">${number(r.amount)}</td></tr>`).join('')}${rows.length?'':`<tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>`}<tr><td></td><td><b>Tổng cộng</b></td><td class="money"><b>${number(total)}</b></td></tr></tbody></table><div class="sign"><div>Ngày ...... tháng ...... năm ......</div><b>NGƯỜI ĐẠI DIỆN HỘ KINH DOANH/<br>CÁ NHÂN KINH DOANH</b><br><span class="small">(Ký, ghi rõ họ tên, đóng dấu nếu có)</span><div style="height:72px"></div><b>${escapeHtml(st.ownerName||'')}</b></div></div>`;
    }
    function renderS1a(){ document.getElementById('reportS1a-section').innerHTML = `${dateToolbar()}<div class="card print-area"><div class="toolbar no-print"><button class="btn green" onclick="exportS1aExcel()">Xuất Excel S1a-HKD</button><button class="btn" onclick="printS1a()">In / Lưu PDF</button></div><div class="s1a-preview">${s1aHtml()}</div></div>`; document.getElementById('print-section').innerHTML = `<div class="s1a-preview">${s1aHtml()}</div>`; }

    function openModal(title, body, footer){ document.getElementById('modalTitle').textContent=title; document.getElementById('modalBody').innerHTML=body; document.getElementById('modalFooter').innerHTML=footer; document.getElementById('modalBackdrop').classList.add('open'); }
    function closeModal(){ document.getElementById('modalBackdrop').classList.remove('open'); }
    function val(name){ return document.querySelector(`[name="${name}"]`)?.value?.trim() || ''; }
    function numVal(name){ return Number(String(val(name)).replace(/,/g,''))||0; }

    function productSelectOptions(selectedId=''){
      return `<option value="">-- Chọn sản phẩm --</option>` + db.products.map(p=>`<option value="${p.id}" ${selectedId===p.id?'selected':''}>${escapeHtml(p.category ? p.category + ' - ' + p.name : p.name)}</option>`).join('');
    }
    function orderItemRowHtml(item={}, index=0){
      const rowId = item.id || id();
      return `<div class="order-item-row" data-row-id="${rowId}">
        <div class="order-item-title"><b>Sản phẩm #${index+1}</b><button class="btn red mini" type="button" onclick="removeOrderItemRow(this)">Xóa dòng</button></div>
        <div class="form-row"><div class="field"><label>Chọn sản phẩm/vé</label><select name="itemProductId" onchange="fillOrderItemProduct(this)">${productSelectOptions(item.productId||'')}</select></div><div class="field"><label>Tên sản phẩm nếu nhập nhanh *</label><input name="itemProductName" value="${escapeHtml(item.productName||'')}" placeholder="VD: Vé Sun World người lớn"></div></div>
        <div class="form-row three"><div class="field"><label>Số lượng *</label><input name="itemQuantity" type="number" min="1" value="${item.quantity||1}" oninput="updateOrderPreview()"></div><div class="field"><label>Giá vốn/1 vé</label><input name="itemCostPrice" type="number" min="0" value="${item.costPrice||0}" oninput="updateOrderPreview()"></div><div class="field"><label>Giá bán/1 vé *</label><input name="itemSalePrice" type="number" min="0" value="${item.salePrice||0}" oninput="updateOrderPreview()"></div></div>
        <div class="form-row"><div class="field"><label>Giảm giá dòng</label><input name="itemDiscount" type="number" min="0" value="${item.discount||0}" oninput="updateOrderPreview()"></div><div class="field"><label>Ghi chú dòng</label><input name="itemNote" value="${escapeHtml(item.note||'')}" placeholder="VD: Vé cuối tuần, trẻ em..."></div></div>
      </div>`;
    }
    function openOrderModal(orderId){
      const o = db.orders.find(x=>x.id===orderId) || {orderDate:todayISO(),usageDate:todayISO(),status:'completed',discount:0,surcharge:0,paid:0};
      const customerOptions = `<option value="">Khách lẻ / nhập nhanh</option>`+db.customers.map(c=>`<option value="${c.id}" ${o.customerId===c.id?'selected':''}>${escapeHtml(c.name)} - ${escapeHtml(c.phone||'')}</option>`).join('');
      const items = normalizeOrderItems(o).length ? normalizeOrderItems(o) : [{id:id(), quantity:1, costPrice:0, salePrice:0, discount:0}];
      openModal(orderId?'Sửa đơn hàng':'Tạo đơn bán vé', `<div class="form"><div class="form-row three"><div class="field"><label>Ngày bán *</label><input name="orderDate" type="date" value="${o.orderDate}"></div><div class="field"><label>Ngày sử dụng</label><input name="usageDate" type="date" value="${o.usageDate||''}"></div><div class="field"><label>Trạng thái</label><select name="status"><option value="completed" ${o.status==='completed'?'selected':''}>Hoàn thành</option><option value="confirmed" ${o.status==='confirmed'?'selected':''}>Đã chốt</option><option value="cancelled" ${o.status==='cancelled'?'selected':''}>Đã hủy</option></select></div></div><div class="form-row"><div class="field"><label>Khách hàng</label><select name="customerId">${customerOptions}</select></div><div class="field"><label>Tên khách nhập nhanh</label><input name="customerName" value="${escapeHtml(o.customerName||'')}" placeholder="VD: Chị Hương"></div></div><div class="order-items-card"><div class="order-items-head"><div><b>Danh sách sản phẩm/vé trong đơn</b><div class="hint">Một đơn có thể thêm nhiều sản phẩm/vé. Mỗi dòng có số lượng, giá vốn và giá bán riêng.</div></div><button class="btn green" type="button" onclick="addOrderItemRow()">+ Thêm sản phẩm</button></div><div id="orderItemsBody">${items.map((item,i)=>orderItemRowHtml(item,i)).join('')}</div></div><div class="form-row three"><div class="field"><label>Giảm giá toàn đơn</label><input name="discount" type="number" min="0" value="${Array.isArray(o.items)?(o.discount||0):0}" oninput="updateOrderPreview()"></div><div class="field"><label>Phụ thu toàn đơn</label><input name="surcharge" type="number" min="0" value="${o.surcharge||0}" oninput="updateOrderPreview()"></div><div class="field"><label>Khách đã thanh toán</label><input name="paid" type="number" min="0" value="${o.paid||0}" oninput="updateOrderPreview()"></div></div><div class="order-total-box"><div class="order-total-item"><span>Doanh thu</span><b id="previewRevenue">0</b></div><div class="order-total-item"><span>Giá vốn</span><b id="previewCost">0</b></div><div class="order-total-item"><span>Lãi gộp</span><b id="previewProfit">0</b></div><div class="order-total-item"><span>Còn nợ</span><b id="previewDebt">0</b></div></div><div class="field"><label>Ghi chú</label><textarea name="note">${escapeHtml(o.note||'')}</textarea></div><p class="hint">Các ô có dấu * là bắt buộc. Phần mềm tự tính doanh thu, giá vốn, lợi nhuận cho cả đơn.</p></div>`, `<button class="btn gray" onclick="closeModal()">Hủy</button><button class="btn primary" onclick="saveOrder('${orderId||''}')">Lưu đơn</button>`);
      updateOrderPreview();
    }
    function addOrderItemRow(item={}){
      const body = document.getElementById('orderItemsBody');
      if(!body) return;
      body.insertAdjacentHTML('beforeend', orderItemRowHtml({...item, id:id(), quantity:item.quantity||1}, body.querySelectorAll('.order-item-row').length));
      renumberOrderRows();
      updateOrderPreview();
    }
    function removeOrderItemRow(button){
      const body = document.getElementById('orderItemsBody');
      const rows = body?.querySelectorAll('.order-item-row') || [];
      if(rows.length <= 1){ alert('Đơn hàng cần ít nhất 1 sản phẩm/vé.'); return; }
      button.closest('.order-item-row')?.remove();
      renumberOrderRows();
      updateOrderPreview();
    }
    function renumberOrderRows(){
      document.querySelectorAll('#orderItemsBody .order-item-row').forEach((row,idx)=>{ const title=row.querySelector('.order-item-title b'); if(title) title.textContent = `Sản phẩm #${idx+1}`; });
    }
    function fillOrderItemProduct(select){
      const p=getProduct(select.value);
      if(!p)return;
      const row=select.closest('.order-item-row');
      row.querySelector('[name="itemProductName"]').value=p.name;
      row.querySelector('[name="itemCostPrice"]').value=p.defaultCost||0;
      row.querySelector('[name="itemSalePrice"]').value=p.defaultPrice||0;
      updateOrderPreview();
    }
    function readOrderItemsFromModal(){
      return [...document.querySelectorAll('#orderItemsBody .order-item-row')].map(row=>{
        const productId = row.querySelector('[name="itemProductId"]')?.value || '';
        const p = getProduct(productId);
        const productName = (row.querySelector('[name="itemProductName"]')?.value || p?.name || '').trim();
        return {
          id: row.dataset.rowId || id(),
          productId,
          productName,
          quantity: Number(row.querySelector('[name="itemQuantity"]')?.value || 0),
          costPrice: Number(row.querySelector('[name="itemCostPrice"]')?.value || 0),
          salePrice: Number(row.querySelector('[name="itemSalePrice"]')?.value || 0),
          discount: Number(row.querySelector('[name="itemDiscount"]')?.value || 0),
          note: (row.querySelector('[name="itemNote"]')?.value || '').trim()
        };
      }).filter(item => item.productName || item.productId);
    }
    function updateOrderPreview(){
      const temp = {items: readOrderItemsFromModal(), discount:numVal('discount'), surcharge:numVal('surcharge'), paid:numVal('paid')};
      const t = getOrderTotals(temp);
      const set = (id,value)=>{ const el=document.getElementById(id); if(el) el.textContent=value; };
      set('previewRevenue', currency(t.revenue));
      set('previewCost', currency(t.totalCost));
      set('previewProfit', currency(t.profit));
      set('previewDebt', currency(Math.max(0,t.debt)));
    }
    function fillProductPrice(pid){
      const p=getProduct(pid); if(!p)return;
      const first = document.querySelector('#orderItemsBody .order-item-row');
      if(!first)return;
      first.querySelector('[name="itemProductName"]').value=p.name;
      first.querySelector('[name="itemCostPrice"]').value=p.defaultCost||0;
      first.querySelector('[name="itemSalePrice"]').value=p.defaultPrice||0;
      updateOrderPreview();
    }
    function saveOrder(orderId){
      const items = readOrderItemsFromModal();
      if(!val('orderDate')){alert('Vui lòng nhập ngày bán.');return;}
      if(!items.length){alert('Vui lòng thêm ít nhất 1 sản phẩm/vé trong đơn.');return;}
      const invalid = items.find(item => !item.productName || item.quantity <= 0 || item.salePrice <= 0);
      if(invalid){alert('Vui lòng kiểm tra lại từng dòng sản phẩm: cần có tên sản phẩm, số lượng > 0 và giá bán > 0.');return;}
      const old = db.orders.find(o=>o.id===orderId) || {};
      const record={id:orderId||id(), code: orderId ? (old.code||'') : 'DH'+new Date().toISOString().replace(/[-:.TZ]/g,'').slice(0,14), orderDate:val('orderDate'), usageDate:val('usageDate'), status:val('status'), customerId:val('customerId'), customerName:val('customerName'), items, productId:items[0]?.productId||'', productName:getOrderProductSummary({items}), quantity:items.reduce((s,i)=>s+Number(i.quantity||0),0), costPrice:items[0]?.costPrice||0, salePrice:items[0]?.salePrice||0, discount:numVal('discount'), surcharge:numVal('surcharge'), paid:numVal('paid'), note:val('note'), createdAt: orderId ? (old.createdAt||new Date().toISOString()) : new Date().toISOString()};
      const idx=db.orders.findIndex(o=>o.id===orderId); if(idx>=0) db.orders[idx]=record; else db.orders.push(record); closeModal(); saveData();
    }
    function editOrder(orderId){ openOrderModal(orderId); }
    function deleteOrder(orderId){ if(confirm('Xóa đơn này?')){db.orders=db.orders.filter(o=>o.id!==orderId); saveData();} }

    function openProductModal(pid){ const p=db.products.find(x=>x.id===pid)||{}; const supplierOptions='<option value="">Không chọn</option>'+db.suppliers.map(s=>`<option value="${s.id}" ${p.supplierId===s.id?'selected':''}>${escapeHtml(s.name)}</option>`).join(''); openModal(pid?'Sửa sản phẩm':'Thêm sản phẩm/vé', `<div class="form"><div class="field"><label>LOẠI VÉ *</label><input name="name" value="${escapeHtml(p.name||'')}"></div><div class="form-row"><div class="field"><label>Danh mục</label><input name="category" value="${escapeHtml(p.category||'Vé khu vui chơi')}"></div><div class="field"><label>Nhà cung cấp</label><select name="supplierId">${supplierOptions}</select></div></div><div class="form-row three"><div class="field"><label>GIÁ CÔNG BỐ</label><input name="publicPrice" type="number" value="${p.publicPrice||0}"></div><div class="field"><label>GIÁ NHẬP</label><input name="defaultCost" type="number" value="${p.defaultCost||0}"></div><div class="field"><label>CTV</label><input name="ctvPrice" type="number" value="${p.ctvPrice||0}"></div></div><div class="form-row"><div class="field"><label>GIÁ BÁN</label><input name="defaultPrice" type="number" value="${p.defaultPrice||0}"></div><div class="field"><label>Đơn vị</label><input name="unit" value="${escapeHtml(p.unit||'vé')}"></div></div><div class="field"><label>GHI CHÚ</label><textarea name="note">${escapeHtml(p.note||'')}</textarea></div></div>`, `<button class="btn gray" onclick="closeModal()">Hủy</button><button class="btn primary" onclick="saveProduct('${pid||''}')">Lưu</button>`); }
    function saveProduct(pid){ if(!val('name')){alert('Vui lòng nhập LOẠI VÉ.');return;} const old=db.products.find(x=>x.id===pid)||{}; const rec={...old,id:pid||id(),name:val('name'),category:val('category'),supplierId:val('supplierId'),unit:val('unit')||'vé',publicPrice:numVal('publicPrice'),defaultCost:numVal('defaultCost'),ctvPrice:numVal('ctvPrice'),defaultPrice:numVal('defaultPrice'),note:val('note')}; const idx=db.products.findIndex(x=>x.id===pid); if(idx>=0)db.products[idx]=rec;else db.products.push(rec); closeModal(); saveData(); }
    function openCustomerModal(cid){
      const c=db.customers.find(x=>x.id===cid)||{};
      openModal(cid?'Sửa khách hàng':'Thêm khách hàng', `<div class="form">
        <div class="field"><label>Tên khách *</label><input name="name" value="${escapeHtml(c.name||'')}"></div>
        <div class="form-row"><div class="field"><label>Số điện thoại</label><input name="phone" value="${escapeHtml(c.phone||'')}"></div><div class="field"><label>Email nhận hóa đơn</label><input name="invoiceEmail" type="email" value="${escapeHtml(c.invoiceEmail||c.email||'')}" placeholder="email@domain.com"></div></div>
        <div class="form-row"><div class="field"><label>Tên đơn vị/cá nhân xuất hóa đơn</label><input name="companyName" value="${escapeHtml(c.companyName||'')}" placeholder="Tên công ty / hộ / cá nhân"></div><div class="field"><label>Mã số thuế</label><input name="taxCode" value="${escapeHtml(c.taxCode||'')}" placeholder="MST nếu có"></div></div>
        <div class="field"><label>Địa chỉ xuất hóa đơn</label><input name="invoiceAddress" value="${escapeHtml(c.invoiceAddress||c.address||'')}" placeholder="Địa chỉ trên hóa đơn"></div>
        <div class="form-row"><div class="field"><label>Nguồn khách</label><input name="source" value="${escapeHtml(c.source||'Facebook/Zalo')}"></div><div class="field"><label>Người mua hàng</label><input name="buyerName" value="${escapeHtml(c.buyerName||'')}" placeholder="Nếu khác tên khách"></div></div>
        <div class="field"><label>Ghi chú</label><textarea name="note">${escapeHtml(c.note||'')}</textarea></div>
      </div>`, `<button class="btn gray" onclick="closeModal()">Hủy</button><button class="btn primary" onclick="saveCustomer('${cid||''}')">Lưu</button>`);
    }
    function saveSimple(type,itemId){ if(!val('name')){alert('Vui lòng nhập tên.');return;} const rec={id:itemId||id(), name:val('name'), phone:val('phone'), source:val('source'), contact:val('contact'), note:val('note')}; const idx=db[type].findIndex(x=>x.id===itemId); if(idx>=0)db[type][idx]=rec; else db[type].push(rec); closeModal(); saveData(); }
    function saveCustomer(cid){
      if(!val('name')){alert('Vui lòng nhập tên khách hàng.');return;}
      const old=db.customers.find(x=>x.id===cid)||{};
      const now=new Date().toISOString();
      const rec={...old,id:cid||id(),name:val('name'),phone:val('phone'),email:val('invoiceEmail'),invoiceEmail:val('invoiceEmail'),companyName:val('companyName'),taxCode:val('taxCode'),invoiceAddress:val('invoiceAddress'),address:val('invoiceAddress'),buyerName:val('buyerName'),source:val('source'),note:val('note'),createdAt:old.createdAt||now,updatedAt:now};
      const idx=db.customers.findIndex(x=>x.id===cid); if(idx>=0)db.customers[idx]=rec; else db.customers.push(rec); closeModal(); saveData();
    }
    function openExpenseModal(eid){ const e=db.expenses.find(x=>x.id===eid)||{date:todayISO(),category:'Quảng cáo'}; openModal(eid?'Sửa chi phí':'Thêm chi phí', `<div class="form"><div class="form-row three"><div class="field"><label>Ngày *</label><input name="date" type="date" value="${e.date}"></div><div class="field"><label>Nhóm</label><select name="category"><option ${e.category==='Quảng cáo'?'selected':''}>Quảng cáo</option><option ${e.category==='Phí chuyển khoản'?'selected':''}>Phí chuyển khoản</option><option ${e.category==='Hoàn/hủy vé'?'selected':''}>Hoàn/hủy vé</option><option ${e.category==='Vận hành'?'selected':''}>Vận hành</option><option ${e.category==='Khác'?'selected':''}>Khác</option></select></div><div class="field"><label>Số tiền *</label><input name="amount" type="number" value="${e.amount||0}"></div></div><div class="field"><label>Nội dung</label><textarea name="description">${escapeHtml(e.description||'')}</textarea></div></div>`, `<button class="btn gray" onclick="closeModal()">Hủy</button><button class="btn primary" onclick="saveExpense('${eid||''}')">Lưu</button>`); }
    function saveExpense(eid){ if(!val('date')||numVal('amount')<=0){alert('Vui lòng nhập ngày và số tiền chi phí.');return;} const rec={id:eid||id(),date:val('date'),category:val('category'),amount:numVal('amount'),description:val('description')}; const idx=db.expenses.findIndex(x=>x.id===eid); if(idx>=0)db.expenses[idx]=rec; else db.expenses.push(rec); closeModal(); saveData(); }
    function deleteItem(type,itemId){ if(confirm('Bạn chắc chắn muốn xóa?')){db[type]=db[type].filter(x=>x.id!==itemId); saveData();} }
    function rowCheckbox(type, itemId){
      return `<input class="row-select" type="checkbox" data-type="${type}" value="${itemId}" onclick="event.stopPropagation()">`;
    }
    function selectAllCheckbox(type){
      return `<input class="select-all" type="checkbox" title="Chọn tất cả dòng đang hiển thị" onchange="toggleSelectAllRows('${type}', this)">`;
    }
    function toggleSelectAllRows(type, source){
      document.querySelectorAll(`.row-select[data-type="${type}"]`).forEach(cb=>{ cb.checked = source.checked; });
    }
    function getSelectedIds(type){
      return [...document.querySelectorAll(`.row-select[data-type="${type}"]:checked`)].map(cb=>cb.value);
    }
    function bulkDeleteBar(type, label){
      return `<div class="bulk-toolbar"><span class="bulk-delete-hint">Có thể tick nhiều dòng để xóa hàng loạt.</span><button class="btn red" onclick="deleteSelectedRows('${type}','${label}')">Xóa dòng đã chọn</button></div>`;
    }
    function deleteSelectedRows(type, label){
      const ids = getSelectedIds(type);
      if(!ids.length){ alert(`Vui lòng tick chọn ít nhất 1 ${label || 'dòng'} cần xóa.`); return; }
      if(!confirm(`Bạn chắc chắn muốn xóa ${ids.length} ${label || 'dòng'} đã chọn?`)) return;
      const idSet = new Set(ids);
      db[type] = db[type].filter(x=>!idSet.has(x.id));
      saveData();
    }


    function normalizeText(value){
      return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/Đ/g,'D').replace(/đ/g,'d').replace(/\s+/g,' ').trim().toUpperCase();
    }
    function parseMoney(value){
      if(typeof value === 'number') return Math.round(value);
      const raw = String(value ?? '').trim();
      if(!raw) return 0;
      const hasK = /K$/i.test(raw) || /K\b/i.test(raw);
      let digits = raw.replace(/[^0-9,.-]/g,'');
      if(!digits) return 0;
      if(digits.includes(',') && digits.includes('.')) digits = digits.replace(/[.,]/g,'');
      else digits = digits.replace(/[.,]/g,'');
      let n = Number(digits) || 0;
      if(hasK && n < 10000) n *= 1000;
      return Math.round(n);
    }
    function headerIndex(headers, names){
      const normalized = headers.map(normalizeText);
      for(const name of names){
        const idx = normalized.indexOf(normalizeText(name));
        if(idx >= 0) return idx;
      }
      return -1;
    }
    function sheetRowsToProducts(sheetName, rows){
      if(!rows || rows.length < 2) return [];
      let headerRowIndex = rows.findIndex(row => row.some(cell => normalizeText(cell).includes('LOAI VE')));
      if(headerRowIndex < 0) headerRowIndex = 0;
      const headers = rows[headerRowIndex] || [];
      const idxName = headerIndex(headers, ['LOẠI VÉ','LOAI VE','TÊN VÉ','TEN VE','SẢN PHẨM','SAN PHAM']);
      const idxPublic = headerIndex(headers, ['GIÁ CÔNG BỐ','GIA CONG BO','GIÁ NIÊM YẾT','GIA NIEM YET']);
      const idxCost = headerIndex(headers, ['GIÁ NHẬP','GIA NHAP','GIÁ VỐN','GIA VON']);
      const idxCtv = headerIndex(headers, ['CTV','GIÁ CTV','GIA CTV','CỘNG TÁC VIÊN','CONG TAC VIEN']);
      const idxSale = headerIndex(headers, ['GIÁ BÁN','GIA BAN','SALE','GIÁ KHÁCH','GIA KHACH']);
      const idxNote = headerIndex(headers, ['GHI CHÚ','GHI CHU','NOTE','LƯU Ý','LUU Y']);
      if(idxName < 0) throw new Error(`Sheet "${sheetName}" thiếu cột LOẠI VÉ.`);
      return rows.slice(headerRowIndex+1).map(row => {
        const name = String(row[idxName] || '').trim();
        if(!name) return null;
        return {
          id: id(),
          name,
          category: sheetName || 'Chưa phân loại',
          supplierId: '',
          unit: 'vé',
          publicPrice: idxPublic >= 0 ? parseMoney(row[idxPublic]) : 0,
          defaultCost: idxCost >= 0 ? parseMoney(row[idxCost]) : 0,
          ctvPrice: idxCtv >= 0 ? parseMoney(row[idxCtv]) : 0,
          defaultPrice: idxSale >= 0 ? parseMoney(row[idxSale]) : 0,
          note: idxNote >= 0 ? String(row[idxNote] || '').trim() : ''
        };
      }).filter(Boolean);
    }
    async function inflateZipData(bytes, method){
      if(method === 0) return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      if(method !== 8) throw new Error('File Excel dùng kiểu nén chưa được hỗ trợ.');
      if(!('DecompressionStream' in window)) throw new Error('Trình duyệt này chưa hỗ trợ đọc file .xlsx trực tiếp. Hãy mở bằng Chrome/Edge mới nhất hoặc lưu thành CSV.');
      const stream = new DecompressionStream('deflate-raw');
      const writer = stream.writable.getWriter();
      await writer.write(bytes);
      await writer.close();
      return await new Response(stream.readable).arrayBuffer();
    }
    function readU16(view, offset){ return view.getUint16(offset, true); }
    function readU32(view, offset){ return view.getUint32(offset, true); }
    async function unzipXlsx(arrayBuffer){
      const view = new DataView(arrayBuffer);
      const bytes = new Uint8Array(arrayBuffer);
      let eocd = -1;
      for(let i = bytes.length - 22; i >= Math.max(0, bytes.length - 66000); i--){
        if(readU32(view, i) === 0x06054b50){ eocd = i; break; }
      }
      if(eocd < 0) throw new Error('Không đọc được cấu trúc file .xlsx.');
      const totalEntries = readU16(view, eocd + 10);
      let cdOffset = readU32(view, eocd + 16);
      const entries = {};
      const decoder = new TextDecoder('utf-8');
      for(let i=0; i<totalEntries; i++){
        if(readU32(view, cdOffset) !== 0x02014b50) break;
        const method = readU16(view, cdOffset + 10);
        const compressedSize = readU32(view, cdOffset + 20);
        const nameLen = readU16(view, cdOffset + 28);
        const extraLen = readU16(view, cdOffset + 30);
        const commentLen = readU16(view, cdOffset + 32);
        const localOffset = readU32(view, cdOffset + 42);
        const name = decoder.decode(bytes.slice(cdOffset + 46, cdOffset + 46 + nameLen));
        const localNameLen = readU16(view, localOffset + 26);
        const localExtraLen = readU16(view, localOffset + 28);
        const dataStart = localOffset + 30 + localNameLen + localExtraLen;
        const compressed = bytes.slice(dataStart, dataStart + compressedSize);
        const data = await inflateZipData(compressed, method);
        entries[name] = decoder.decode(data);
        cdOffset += 46 + nameLen + extraLen + commentLen;
      }
      return entries;
    }
    function xmlDoc(xml){ return new DOMParser().parseFromString(xml, 'application/xml'); }
    function cellRefToColIndex(ref){
      const letters = String(ref||'').replace(/[^A-Z]/gi,'').toUpperCase();
      let n=0; for(const ch of letters){ n = n*26 + ch.charCodeAt(0)-64; }
      return Math.max(0, n-1);
    }
    function parseSharedStrings(xml){
      if(!xml) return [];
      const doc = xmlDoc(xml);
      return [...doc.getElementsByTagName('si')].map(si => [...si.getElementsByTagName('t')].map(t=>t.textContent||'').join(''));
    }
    function parseWorkbookSheets(entries){
      const workbook = xmlDoc(entries['xl/workbook.xml']);
      const rels = xmlDoc(entries['xl/_rels/workbook.xml.rels']);
      const relMap = {};
      [...rels.getElementsByTagName('Relationship')].forEach(r => relMap[r.getAttribute('Id')] = r.getAttribute('Target'));
      return [...workbook.getElementsByTagName('sheet')].map(s => {
        const name = s.getAttribute('name') || 'Danh mục';
        const rid = s.getAttribute('r:id') || s.getAttribute('id');
        let target = relMap[rid] || '';
        if(target && !target.startsWith('xl/')) target = 'xl/' + target.replace(/^\//,'');
        return { name, path: target };
      }).filter(x=>x.path);
    }
    function parseWorksheet(xml, sharedStrings){
      const doc = xmlDoc(xml);
      const rows = [];
      [...doc.getElementsByTagName('row')].forEach(rowEl => {
        const row = [];
        [...rowEl.getElementsByTagName('c')].forEach(c => {
          const col = cellRefToColIndex(c.getAttribute('r'));
          const type = c.getAttribute('t');
          let value = '';
          if(type === 'inlineStr') value = [...c.getElementsByTagName('t')].map(t=>t.textContent||'').join('');
          else {
            const v = c.getElementsByTagName('v')[0];
            value = v ? v.textContent : '';
            if(type === 's') value = sharedStrings[Number(value)] || '';
          }
          row[col] = value;
        });
        rows.push(row.map(x=>x ?? ''));
      });
      return rows;
    }
    async function readXlsxFile(file){
      const arrayBuffer = await file.arrayBuffer();
      const entries = await unzipXlsx(arrayBuffer);
      const sharedStrings = parseSharedStrings(entries['xl/sharedStrings.xml']);
      const sheets = parseWorkbookSheets(entries);
      return sheets.map(sheet => ({ name: sheet.name, rows: parseWorksheet(entries[sheet.path], sharedStrings) }));
    }
    async function readCsvFile(file){
      const text = await file.text();
      const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
      const parseLine = line => {
        const out=[]; let cur='', q=false;
        for(let i=0;i<line.length;i++){ const ch=line[i]; if(ch==='"'){ if(q && line[i+1]==='"'){cur+='"';i++;} else q=!q; } else if(ch===',' && !q){out.push(cur);cur='';} else cur+=ch; }
        out.push(cur); return out;
      };
      return [{ name: file.name.replace(/\.csv$/i,'') || 'Danh mục', rows: lines.map(parseLine) }];
    }
    async function importProductsFromFile(event){
      const file = event.target.files[0];
      event.target.value = '';
      if(!file) return;
      const resultBox = document.getElementById('importResult');
      if(resultBox) resultBox.innerHTML = '<div class="import-result">Đang đọc file, vui lòng chờ...</div>';
      try{
        const sheets = file.name.toLowerCase().endsWith('.csv') ? await readCsvFile(file) : await readXlsxFile(file);
        let imported = [];
        for(const sheet of sheets){ imported = imported.concat(sheetRowsToProducts(sheet.name, sheet.rows)); }
        if(!imported.length){ alert('Không tìm thấy dòng sản phẩm hợp lệ trong file.'); return; }
        const choice = confirm(`Tìm thấy ${imported.length} sản phẩm/vé từ ${sheets.length} bảng tính.\n\nBấm OK để nhập thêm vào danh sách hiện tại.\nBấm Cancel để thay thế toàn bộ Sản phẩm/vé hiện có.`);
        if(choice) db.products.push(...imported); else db.products = imported;
        saveData();
        setTimeout(()=>{ const box=document.getElementById('importResult'); if(box) box.innerHTML = `<div class="import-result">Đã nhập ${imported.length} sản phẩm/vé từ ${sheets.length} bảng tính. Mỗi sheet đã được dùng làm danh mục.</div>`; },50);
      }catch(error){
        alert('Không nhập được file: ' + error.message);
        if(resultBox) resultBox.innerHTML = `<div class="import-result">Lỗi: ${escapeHtml(error.message)}</div>`;
      }
    }
    function downloadProductTemplateCsv(){
      const rows = [
        ['LOẠI VÉ','GIÁ CÔNG BỐ','GIÁ NHẬP','CTV','GIÁ BÁN','GHI CHÚ'],
        ['Vé người lớn','1000000','850000','900000','950000','Áp dụng ngày thường'],
        ['Vé trẻ em','800000','650000','700000','750000','Cao dưới 1m miễn phí nếu có']
      ];
      download('mau_nhap_san_pham_ve.csv', rows.map(r=>r.map(csvEscape).join(',')).join('\n'), 'text/csv;charset=utf-8');
    }

    function renderSettings(){ const s=db.settings; document.getElementById('settings-section').innerHTML = `<div class="grid two"><div class="card"><h3>Thông tin hộ kinh doanh</h3><div class="form"><div class="field"><label>Tên hộ/cá nhân kinh doanh</label><input id="set-businessName" value="${escapeHtml(s.businessName)}"></div><div class="field"><label>Địa chỉ</label><input id="set-address" value="${escapeHtml(s.address)}"></div><div class="form-row"><div class="field"><label>Mã số thuế</label><input id="set-taxCode" value="${escapeHtml(s.taxCode)}"></div><div class="field"><label>Địa điểm kinh doanh</label><input id="set-businessLocation" value="${escapeHtml(s.businessLocation)}"></div></div><div class="form-row"><div class="field"><label>Người đại diện</label><input id="set-ownerName" value="${escapeHtml(s.ownerName)}"></div><div class="field"><label>Đơn vị tính</label><input id="set-unit" value="${escapeHtml(s.unit)}"></div></div><button class="btn primary" onclick="saveSettings()">Lưu cài đặt</button></div></div><div class="card"><h3>Sao lưu & khôi phục</h3><div class="grid"><button class="btn orange" onclick="downloadBackup()">Tải file sao lưu JSON</button><button class="btn" onclick="document.getElementById('restoreFile').click()">Khôi phục từ file JSON</button><input id="restoreFile" type="file" accept=".json" style="display:none" onchange="restoreBackup(event)"><button class="btn green" onclick="exportAllCsv()">Xuất toàn bộ dữ liệu CSV</button><button class="btn" onclick="showDatabasePath()">Xem vị trí file SQLite</button><button class="btn orange" onclick="backupSQLiteDatabase()">Sao lưu SQLite</button></div><p class="hint">Dữ liệu chính được lưu trong file SQLite của phần mềm. File sao lưu JSON vẫn nên tải định kỳ để dự phòng khi đổi máy.</p><div class="danger-zone"><b>Vùng nguy hiểm</b><p class="hint">Chỉ bấm khi muốn xóa toàn bộ dữ liệu.</p><button class="btn red" onclick="resetData()">Xóa toàn bộ dữ liệu</button></div></div></div>`; }
    function saveSettings(){ ['businessName','address','taxCode','businessLocation','ownerName','unit'].forEach(k=>db.settings[k]=document.getElementById('set-'+k).value); saveData(); showToast('Đã lưu cài đặt.'); }

    function csvEscape(v){ const s=String(v??''); return '"'+s.replace(/"/g,'""')+'"'; }
    function download(filename, content, type='text/plain;charset=utf-8'){ const blob=new Blob([content],{type}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); }
    function exportOrdersCsv(){
      const rows=[['Ngày bán','Mã đơn','Khách','Sản phẩm trong đơn','Tổng số lượng','Doanh thu','Giá vốn','Lợi nhuận','Đã thu','Còn nợ']];
      db.orders.forEach(o=>{const t=getOrderTotals(o);rows.push([o.orderDate,o.code,getCustomer(o.customerId)?.name||o.customerName,getOrderProductSummary(o),t.quantity,t.revenue,t.totalCost,t.profit,t.paid,t.debt]);});
      download('don_hang.csv', rows.map(r=>r.map(csvEscape).join(',')).join('\n'), 'text/csv;charset=utf-8');
    }
    function exportReportCsv(){ const s=getSummary(); const rows=[['Từ ngày',reportRange.from],['Đến ngày',reportRange.to],['Doanh thu',s.revenue],['Giá vốn',s.cost],['Chi phí',s.expenses],['Lợi nhuận thực',s.netProfit]]; download('bao_cao_doanh_thu.csv', rows.map(r=>r.map(csvEscape).join(',')).join('\n'), 'text/csv;charset=utf-8'); }
    function exportAllCsv(){ exportOrdersCsv(); setTimeout(()=>exportReportCsv(),300); }
    async function showDatabasePath(){
      if(!isTauriRuntime()){ alert('Bản HTML đang chạy ngoài Tauri nên chưa có file SQLite.'); return; }
      try{ const path = await tauriInvoke('get_database_path'); alert('File database SQLite đang lưu tại:\n' + path); }
      catch(error){ alert('Không lấy được đường dẫn database: ' + error); }
    }
    async function backupSQLiteDatabase(){
      if(!isTauriRuntime()){ alert('Bản HTML đang chạy ngoài Tauri nên chưa có file SQLite.'); return; }
      try{ const path = await tauriInvoke('backup_database'); alert('Đã sao lưu database SQLite tại:\n' + path); }
      catch(error){ alert('Không sao lưu được SQLite: ' + error); }
    }

    function exportS1aExcel(){ const html=`<html><head><meta charset="UTF-8"></head><body>${s1aHtml()}</body></html>`; download(`Mau_S1a_HKD_${reportRange.from}_${reportRange.to}.xls`, html, 'application/vnd.ms-excel;charset=utf-8'); }
    function printS1a(){ activeSection='print'; setTitle(); setTimeout(()=>{window.print(); activeSection='reportS1a'; render();},100); }
    function downloadBackup(){ download(`so_doanh_thu_backup_${new Date().toISOString().slice(0,19).replace(/[:T]/g,'_')}.json`, JSON.stringify(db,null,2), 'application/json;charset=utf-8'); }
    function restoreBackup(event){ const file=event.target.files[0]; if(!file)return; const reader=new FileReader(); reader.onload=()=>{ try{const data=JSON.parse(reader.result); if(!data.orders||!data.products) throw new Error('Sai định dạng'); if(confirm('Khôi phục sẽ thay thế dữ liệu hiện tại. Tiếp tục?')){db=data; saveData(); showToast('Đã khôi phục dữ liệu.');}}catch(e){alert('File sao lưu không hợp lệ.');} }; reader.readAsText(file); }
    function resetData(){ if(confirm('Xóa toàn bộ dữ liệu? Hành động này không thể hoàn tác.')){ localStorage.removeItem(STORAGE_KEY); db=structuredClone(defaultData); saveData(); } }



    /* ===== BẢN V7: lọc dữ liệu, phân loại sản phẩm, website NCC, xuất S1a .xlsx, biểu đồ tròn ===== */
    let orderFilter = {date:'', from:'', to:'', keyword:''};
    let productFilter = {from:'', to:'', category:'', keyword:''};
    let productPage = 1;
    let orderPage = 1;
    let customerPage = 1;
    let supplierPage = 1;
    let customerKeyword = '';
    let supplierKeyword = '';
    const PIE_COLORS = ['#2563eb','#059669','#ea580c','#7c3aed','#dc2626','#0891b2','#ca8a04','#475467'];

    function dateOnly(value){ return String(value||'').slice(0,10); }
    function searchable(value){ return normalizeText(value || ''); }
    function matchKeyword(text, keyword){ return !keyword || searchable(text).includes(searchable(keyword)); }
    function productCreatedDate(p){ return dateOnly(p.createdAt || p.updatedAt || ''); }
    function applyDateFilter(date, from, to){
      if(!from && !to) return true;
      if(!date) return true; // dữ liệu cũ chưa có ngày tạo vẫn hiển thị để tránh mất danh sách.
      return (!from || date >= from) && (!to || date <= to);
    }
    function getFilterValue(id){
      const el = document.getElementById(id);
      return el ? String(el.value || '').trim() : '';
    }
    function applyOrderFilters(){
      orderFilter = {date:'', from: getFilterValue('order-filter-from'), to: getFilterValue('order-filter-to'), keyword: getFilterValue('order-filter-keyword')};
      orderPage = 1;
      renderOrders();
    }
    function applyProductFilters(){
      productFilter = {
        from: getFilterValue('product-filter-from'),
        to: getFilterValue('product-filter-to'),
        category: getFilterValue('product-filter-category'),
        keyword: getFilterValue('product-filter-keyword')
      };
      productPage = 1;
      renderProducts();
    }
    function applyCustomerSearch(){ customerKeyword = getFilterValue('customer-search-keyword'); customerPage = 1; renderCustomers(); }
    function applySupplierSearch(){ supplierKeyword = getFilterValue('supplier-search-keyword'); supplierPage = 1; renderSuppliers(); }
    function clearOrderFilters(){ orderFilter={date:'',from:'',to:'',keyword:''}; orderPage=1; renderOrders(); }
    function clearProductFilters(){ productFilter={from:'',to:'',category:'',keyword:''}; productPage=1; renderProducts(); }
    function clearCustomerSearch(){ customerKeyword=''; customerPage=1; renderCustomers(); }
    function clearSupplierSearch(){ supplierKeyword=''; supplierPage=1; renderSuppliers(); }
    function setProductPage(page){ productPage=Math.max(1,page); renderProducts(); }
    function setOrderPage(page){ orderPage=Math.max(1,page); renderOrders(); }
    function setCustomerPage(page){ customerPage=Math.max(1,page); renderCustomers(); }
    function setSupplierPage(page){ supplierPage=Math.max(1,page); renderSuppliers(); }

    function filteredOrdersForPage(){
      const kw = orderFilter.keyword;
      return [...db.orders].filter(o=>{
        const d = o.orderDate || '';
        const dateOk = (!orderFilter.from || d >= orderFilter.from) && (!orderFilter.to || d <= orderFilter.to);
        const c = getCustomer(o.customerId);
        const text = [o.code, o.orderDate, o.usageDate, c?.name, c?.phone, o.customerName, getOrderProductSummary(o), o.note].join(' ');
        return dateOk && matchKeyword(text, kw);
      }).sort((a,b)=>String(b.orderDate||'').localeCompare(String(a.orderDate||'')) || String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
    }

    function renderOrders(){
      const rows = filteredOrdersForPage();
      const pageSize = 10;
      const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
      if(orderPage > totalPages) orderPage = totalPages;
      const start = (orderPage - 1) * pageSize;
      const pageRows = rows.slice(start, start + pageSize);
      document.getElementById('orders-section').innerHTML = `<div class="card">
        <div class="filter-card"><div class="toolbar toolbar-split">
          <div class="left-tools"><button class="btn primary" onclick="openOrderModal()">+ Tạo đơn</button><button class="btn" onclick="exportOrdersCsv()">Xuất CSV đơn hàng</button></div>
          <div class="right-tools search-tools">
            <div class="field"><label>Từ ngày</label><input id="order-filter-from" type="date" value="${orderFilter.from}"></div>
            <div class="field"><label>Đến ngày</label><input id="order-filter-to" type="date" value="${orderFilter.to}"></div>
            <div class="field keyword-field"><label>Tìm kiếm</label><input id="order-filter-keyword" placeholder="Mã đơn, khách, SĐT, sản phẩm..." value="${escapeHtml(orderFilter.keyword)}" onkeydown="handleSearchKey(event,'orders')" oninput="rememberTypingValue(this)"></div>
            <button class="btn primary" onclick="applyOrderFilters()">Tìm kiếm</button>
            <button class="btn gray" onclick="clearOrderFilters()">Xóa lọc</button>
          </div>
        </div></div>
        <div class="filter-summary">Đang hiển thị ${rows.length} / ${db.orders.length} đơn hàng</div>
        ${rows.length?bulkDeleteBar('orders','đơn hàng') + ordersTable(pageRows):'<div class="empty">Không có đơn hàng phù hợp.</div>'}
        <div class="pagination"><span>Trang ${orderPage}/${totalPages} · Hiển thị ${pageRows.length} dòng, tối đa 10 dòng/trang · Tổng ${rows.length} đơn hàng</span><button class="btn gray" ${orderPage<=1?'disabled':''} onclick="setOrderPage(orderPage-1)">Trước</button><button class="btn gray" ${orderPage>=totalPages?'disabled':''} onclick="setOrderPage(orderPage+1)">Sau</button></div>
      </div>`;
    }

    function filteredProductsForPage(){
      return [...db.products].filter(p=>{
        const dateOk = applyDateFilter(productCreatedDate(p), productFilter.from, productFilter.to);
        const categoryOk = !productFilter.category || (p.category||'') === productFilter.category;
        const supplier = getSupplier(p.supplierId);
        const text = [p.name,p.category,p.type,p.note,p.unit,supplier?.name].join(' ');
        return dateOk && categoryOk && matchKeyword(text, productFilter.keyword);
      }).sort((a,b)=>String(a.category||'').localeCompare(String(b.category||'')) || String(a.name||'').localeCompare(String(b.name||'')));
    }

    function renderProducts(){
      const categories = [...new Set(db.products.map(p=>p.category).filter(Boolean))].sort();
      const rows = filteredProductsForPage();
      const pageSize = 10;
      const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
      if(productPage > totalPages) productPage = totalPages;
      const start = (productPage - 1) * pageSize;
      const pageRows = rows.slice(start, start + pageSize);
      const categoryOptions = `<option value="">Tất cả danh mục</option>` + categories.map(c=>`<option value="${escapeHtml(c)}" ${productFilter.category===c?'selected':''}>${escapeHtml(c)}</option>`).join('');
      document.getElementById('products-section').innerHTML = `<div class="card">
        <div class="toolbar"><button class="btn primary" onclick="openProductModal()">+ Thêm sản phẩm/vé</button><button class="btn green" onclick="document.getElementById('productExcelFile').click()">Nhập từ Excel</button><button class="btn" onclick="downloadProductTemplateCsv()">Tải file mẫu CSV</button><input id="productExcelFile" type="file" accept=".xlsx,.csv" style="display:none" onchange="importProductsFromFile(event)"></div>
        <div class="import-box"><b>Nhập sản phẩm từ Excel:</b> mỗi sheet/bảng tính sẽ được hiểu là một <b>danh mục</b>. Các cột hỗ trợ: <b>LOẠI VÉ, PHÂN LOẠI, GIÁ CÔNG BỐ, GIÁ NHẬP, CTV, GIÁ BÁN, GHI CHÚ</b>.<div class="hint">Nếu file không có cột PHÂN LOẠI, phần mềm vẫn nhập bình thường.</div><div id="importResult"></div></div>
        <div class="filter-card"><div class="toolbar">
          <div class="field"><label>Từ ngày tạo</label><input id="product-filter-from" type="date" value="${productFilter.from}"></div>
          <div class="field"><label>Đến ngày tạo</label><input id="product-filter-to" type="date" value="${productFilter.to}"></div>
          <div class="field"><label>Danh mục</label><select id="product-filter-category">${categoryOptions}</select></div>
          <div class="field" style="min-width:260px"><label>Tìm kiếm</label><input id="product-filter-keyword" placeholder="Loại vé, phân loại, ghi chú..." value="${escapeHtml(productFilter.keyword)}" onkeydown="handleSearchKey(event,'products')" oninput="rememberTypingValue(this)"></div>
          <button class="btn primary" onclick="applyProductFilters()">Tìm kiếm</button>
          <button class="btn gray" onclick="clearProductFilters()">Xóa lọc</button>
        </div></div>
        <div class="hint" style="margin-bottom:10px">Danh mục hiện có: ${categories.length ? categories.map(c=>`<span class="badge">${escapeHtml(c)}</span>`).join(' ') : 'Chưa có'}</div>
        ${rows.length?`${bulkDeleteBar('products','sản phẩm')}<div class="table-wrap"><table class="product-table"><thead><tr><th class="select-col">${selectAllCheckbox('products')}</th><th class="col-name">Loại vé</th><th class="col-category">Danh mục</th><th class="col-type">Phân loại</th><th class="money col-money">Giá công bố</th><th class="money col-money">Giá nhập</th><th class="money col-money">CTV</th><th class="money col-money">Giá bán</th><th class="col-note">Ghi chú</th><th class="col-date">Ngày tạo</th><th class="col-actions"></th></tr></thead><tbody>${pageRows.map(p=>`<tr><td class="select-cell">${rowCheckbox('products', p.id)}</td><td><b>${escapeHtml(p.name)}</b></td><td>${escapeHtml(p.category||'')}</td><td>${escapeHtml(p.type||'')}</td><td class="money">${currency(p.publicPrice)}</td><td class="money">${currency(p.defaultCost)}</td><td class="money">${currency(p.ctvPrice)}</td><td class="money">${currency(p.defaultPrice)}</td><td class="product-note-cell">${productNotePreview(p)}</td><td>${productCreatedDate(p)||'-'}</td><td><button class="btn gray" onclick="openProductModal('${p.id}')">Sửa</button> <button class="btn red" onclick="deleteItem('products','${p.id}')">Xóa</button></td></tr>`).join('')}</tbody></table></div>
        <div class="pagination"><span>Trang ${productPage}/${totalPages} · Hiển thị ${pageRows.length} dòng, tối đa 10 dòng/trang · Tổng ${rows.length} sản phẩm</span><button class="btn gray" ${productPage<=1?'disabled':''} onclick="setProductPage(productPage-1)">Trước</button><button class="btn gray" ${productPage>=totalPages?'disabled':''} onclick="setProductPage(productPage+1)">Sau</button></div>`:'<div class="empty">Chưa có sản phẩm phù hợp bộ lọc.</div>'}
      </div>`;
    }

    function renderCustomers(){
      const rows = db.customers.filter(c=>matchKeyword([c.name,c.phone,c.source,c.note,c.companyName,c.taxCode,c.invoiceAddress,c.invoiceEmail].join(' '), customerKeyword));
      const pageSize = 10;
      const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
      if(customerPage > totalPages) customerPage = totalPages;
      const start = (customerPage - 1) * pageSize;
      const pageRows = rows.slice(start, start + pageSize);
      document.getElementById('customers-section').innerHTML = `<div class="card"><div class="toolbar toolbar-split"><div class="left-tools"><button class="btn primary" onclick="openCustomerModal()">+ Thêm khách hàng</button></div><div class="right-tools search-tools"><div class="field keyword-field"><label>Tìm kiếm</label><input id="customer-search-keyword" placeholder="Tên khách, SĐT, MST, đơn vị..." value="${escapeHtml(customerKeyword)}" onkeydown="handleSearchKey(event,'customers')" oninput="rememberTypingValue(this)"></div><button class="btn primary" onclick="applyCustomerSearch()">Tìm kiếm</button><button class="btn gray" onclick="clearCustomerSearch()">Xóa lọc</button></div></div><div class="filter-summary">Đang hiển thị ${rows.length} / ${db.customers.length} khách hàng</div>${rows.length?`${bulkDeleteBar('customers','khách hàng')}<div class="table-wrap"><table class="customers-table"><thead><tr><th class="select-col">${selectAllCheckbox('customers')}</th><th>Tên</th><th>SĐT</th><th>MST</th><th>Tên đơn vị xuất HĐ</th><th>Nguồn</th><th class="money">Tổng mua</th><th class="money">Còn nợ</th><th></th></tr></thead><tbody>${pageRows.map(c=>{const orders=db.orders.filter(o=>o.customerId===c.id&&o.status!=='cancelled');const s=getSummary(orders,[]);return `<tr><td class="select-cell">${rowCheckbox('customers', c.id)}</td><td><b>${escapeHtml(c.name)}</b><div class="hint">${escapeHtml(c.invoiceEmail||'')}</div></td><td>${escapeHtml(c.phone||'')}</td><td>${escapeHtml(c.taxCode||'')}</td><td>${escapeHtml(c.companyName||'')}</td><td>${escapeHtml(c.source||'')}</td><td class="money">${currency(s.revenue)}</td><td class="money">${currency(s.debt)}</td><td><button class="btn gray" onclick="openCustomerModal('${c.id}')">Sửa</button> <button class="btn red" onclick="deleteItem('customers','${c.id}')">Xóa</button></td></tr>`}).join('')}</tbody></table></div><div class="pagination"><span>Trang ${customerPage}/${totalPages} · Hiển thị ${pageRows.length} dòng, tối đa 10 dòng/trang · Tổng ${rows.length} khách hàng</span><button class="btn gray" ${customerPage<=1?'disabled':''} onclick="setCustomerPage(customerPage-1)">Trước</button><button class="btn gray" ${customerPage>=totalPages?'disabled':''} onclick="setCustomerPage(customerPage+1)">Sau</button></div>`:'<div class="empty">Không có khách hàng phù hợp.</div>'}</div>`;
    }

    function renderSuppliers(){
      const rows = db.suppliers.filter(s=>matchKeyword([s.name,s.contact,s.phone,s.website,s.note].join(' '), supplierKeyword));
      const pageSize = 10;
      const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
      if(supplierPage > totalPages) supplierPage = totalPages;
      const start = (supplierPage - 1) * pageSize;
      const pageRows = rows.slice(start, start + pageSize);
      document.getElementById('suppliers-section').innerHTML = `<div class="card"><div class="toolbar toolbar-split"><div class="left-tools"><button class="btn primary" onclick="openSupplierModal()">+ Thêm nhà cung cấp</button></div><div class="right-tools search-tools"><div class="field keyword-field"><label>Tìm kiếm</label><input id="supplier-search-keyword" placeholder="Tên NCC, liên hệ, SĐT, website..." value="${escapeHtml(supplierKeyword)}" onkeydown="handleSearchKey(event,'suppliers')" oninput="rememberTypingValue(this)"></div><button class="btn primary" onclick="applySupplierSearch()">Tìm kiếm</button><button class="btn gray" onclick="clearSupplierSearch()">Xóa lọc</button></div></div><div class="filter-summary">Đang hiển thị ${rows.length} / ${db.suppliers.length} nhà cung cấp</div>${rows.length?`${bulkDeleteBar('suppliers','nhà cung cấp')}<div class="table-wrap"><table class="suppliers-table"><thead><tr><th class="select-col">${selectAllCheckbox('suppliers')}</th><th>Tên</th><th>Liên hệ</th><th>SĐT</th><th>Website</th><th>Ghi chú</th><th></th></tr></thead><tbody>${pageRows.map(s=>`<tr><td class="select-cell">${rowCheckbox('suppliers', s.id)}</td><td><b>${escapeHtml(s.name)}</b></td><td>${escapeHtml(s.contact||'')}</td><td>${escapeHtml(s.phone||'')}</td><td>${s.website?`<a class="website-link" href="${escapeHtml(urlWithProtocol(s.website))}" target="_blank" rel="noreferrer">${escapeHtml(s.website)}</a>`:''}</td><td>${escapeHtml(s.note||'')}</td><td><button class="btn gray" onclick="openSupplierModal('${s.id}')">Sửa</button> <button class="btn red" onclick="deleteItem('suppliers','${s.id}')">Xóa</button></td></tr>`).join('')}</tbody></table></div><div class="pagination"><span>Trang ${supplierPage}/${totalPages} · Hiển thị ${pageRows.length} dòng, tối đa 10 dòng/trang · Tổng ${rows.length} nhà cung cấp</span><button class="btn gray" ${supplierPage<=1?'disabled':''} onclick="setSupplierPage(supplierPage-1)">Trước</button><button class="btn gray" ${supplierPage>=totalPages?'disabled':''} onclick="setSupplierPage(supplierPage+1)">Sau</button></div>`:'<div class="empty">Không có nhà cung cấp phù hợp.</div>'}</div>`;
    }

    function urlWithProtocol(url){ const u=String(url||'').trim(); if(!u) return ''; return /^https?:\/\//i.test(u) ? u : 'https://' + u; }

    function productNotePreview(p){
      const note = String(p.note || '').trim();
      if(!note) return '';
      const needsMore = note.length > 120 || note.split(/\n/).length > 4;
      return `<div class="note-clamp">${escapeHtml(note)}</div>${needsMore ? `<button class="link-button" onclick="openProductDetailModal('${p.id}')">... Xem thêm</button>` : ''}`;
    }
    function openProductDetailModal(pid){
      const p = db.products.find(x=>x.id===pid);
      if(!p) return;
      const supplier = getSupplier(p.supplierId);
      openModal('Thông tin sản phẩm/vé', `<div class="detail-grid">
        <b>Loại vé</b><div>${escapeHtml(p.name||'')}</div>
        <b>Danh mục</b><div>${escapeHtml(p.category||'')}</div>
        <b>Phân loại</b><div>${escapeHtml(p.type||'')}</div>
        <b>Nhà cung cấp</b><div>${escapeHtml(supplier?.name||'')}</div>
        <b>Giá công bố</b><div>${currency(p.publicPrice)}</div>
        <b>Giá nhập</b><div>${currency(p.defaultCost)}</div>
        <b>CTV</b><div>${currency(p.ctvPrice)}</div>
        <b>Giá bán</b><div>${currency(p.defaultPrice)}</div>
        <b>Đơn vị</b><div>${escapeHtml(p.unit||'vé')}</div>
        <b>Ngày tạo</b><div>${productCreatedDate(p)||'-'}</div>
        <b>Ghi chú</b><div class="detail-note">${escapeHtml(p.note||'')}</div>
      </div>`, `<button class="btn gray" onclick="closeModal()">Đóng</button><button class="btn primary" onclick="openProductModal('${p.id}')">Sửa sản phẩm</button>`);
    }

    function openProductModal(pid){
      const p=db.products.find(x=>x.id===pid)||{};
      const supplierOptions='<option value="">Không chọn</option>'+db.suppliers.map(s=>`<option value="${s.id}" ${p.supplierId===s.id?'selected':''}>${escapeHtml(s.name)}</option>`).join('');
      openModal(pid?'Sửa sản phẩm':'Thêm sản phẩm/vé', `<div class="form"><div class="field"><label>LOẠI VÉ *</label><input name="name" value="${escapeHtml(p.name||'')}"></div><div class="form-row three"><div class="field"><label>Danh mục</label><input name="category" value="${escapeHtml(p.category||'Vé khu vui chơi')}"></div><div class="field"><label>Phân loại</label><input name="type" value="${escapeHtml(p.type||'')}" placeholder="VD: Người lớn, trẻ em, cuối tuần..."></div><div class="field"><label>Nhà cung cấp</label><select name="supplierId">${supplierOptions}</select></div></div><div class="form-row three"><div class="field"><label>GIÁ CÔNG BỐ</label><input name="publicPrice" type="number" value="${p.publicPrice||0}"></div><div class="field"><label>GIÁ NHẬP</label><input name="defaultCost" type="number" value="${p.defaultCost||0}"></div><div class="field"><label>CTV</label><input name="ctvPrice" type="number" value="${p.ctvPrice||0}"></div></div><div class="form-row"><div class="field"><label>GIÁ BÁN</label><input name="defaultPrice" type="number" value="${p.defaultPrice||0}"></div><div class="field"><label>Đơn vị</label><input name="unit" value="${escapeHtml(p.unit||'vé')}"></div></div><div class="field"><label>GHI CHÚ</label><textarea name="note">${escapeHtml(p.note||'')}</textarea></div></div>`, `<button class="btn gray" onclick="closeModal()">Hủy</button><button class="btn primary" onclick="saveProduct('${pid||''}')">Lưu</button>`);
    }
    function saveProduct(pid){
      if(!val('name')){alert('Vui lòng nhập LOẠI VÉ.');return;}
      const old=db.products.find(x=>x.id===pid)||{};
      const now = new Date().toISOString();
      const rec={...old,id:pid||id(),name:val('name'),category:val('category'),type:val('type'),supplierId:val('supplierId'),unit:val('unit')||'vé',publicPrice:numVal('publicPrice'),defaultCost:numVal('defaultCost'),ctvPrice:numVal('ctvPrice'),defaultPrice:numVal('defaultPrice'),note:val('note'),createdAt:old.createdAt||now,updatedAt:now};
      const idx=db.products.findIndex(x=>x.id===pid); if(idx>=0)db.products[idx]=rec;else db.products.push(rec); closeModal(); saveData();
    }

    function openSupplierModal(sid){
      const s=db.suppliers.find(x=>x.id===sid)||{};
      openModal(sid?'Sửa nhà cung cấp':'Thêm nhà cung cấp', `<div class="form"><div class="field"><label>Tên nhà cung cấp *</label><input name="name" value="${escapeHtml(s.name||'')}"></div><div class="form-row"><div class="field"><label>Người liên hệ</label><input name="contact" value="${escapeHtml(s.contact||'')}"></div><div class="field"><label>Số điện thoại</label><input name="phone" value="${escapeHtml(s.phone||'')}"></div></div><div class="field"><label>Website</label><input name="website" value="${escapeHtml(s.website||'')}" placeholder="VD: https://example.com"></div><div class="field"><label>Ghi chú</label><textarea name="note">${escapeHtml(s.note||'')}</textarea></div></div>`, `<button class="btn gray" onclick="closeModal()">Hủy</button><button class="btn primary" onclick="saveSupplier('${sid||''}')">Lưu</button>`);
    }
    function saveSupplier(sid){
      if(!val('name')){alert('Vui lòng nhập tên nhà cung cấp.');return;}
      const old=db.suppliers.find(x=>x.id===sid)||{}; const now=new Date().toISOString();
      const rec={...old,id:sid||id(),name:val('name'),contact:val('contact'),phone:val('phone'),website:val('website'),note:val('note'),createdAt:old.createdAt||now,updatedAt:now};
      const idx=db.suppliers.findIndex(x=>x.id===sid); if(idx>=0)db.suppliers[idx]=rec; else db.suppliers.push(rec); closeModal(); saveData();
    }

    function sheetRowsToProducts(sheetName, rows){
      if(!rows || rows.length < 2) return [];
      let headerRowIndex = rows.findIndex(row => row.some(cell => normalizeText(cell).includes('LOAI VE')));
      if(headerRowIndex < 0) headerRowIndex = 0;
      const headers = rows[headerRowIndex] || [];
      const idxName = headerIndex(headers, ['LOẠI VÉ','LOAI VE','TÊN VÉ','TEN VE','SẢN PHẨM','SAN PHAM']);
      const idxType = headerIndex(headers, ['PHÂN LOẠI','PHAN LOAI','LOẠI','LOAI','NHÓM VÉ','NHOM VE']);
      const idxPublic = headerIndex(headers, ['GIÁ CÔNG BỐ','GIA CONG BO','GIÁ NIÊM YẾT','GIA NIEM YET']);
      const idxCost = headerIndex(headers, ['GIÁ NHẬP','GIA NHAP','GIÁ VỐN','GIA VON']);
      const idxCtv = headerIndex(headers, ['CTV','GIÁ CTV','GIA CTV','CỘNG TÁC VIÊN','CONG TAC VIEN']);
      const idxSale = headerIndex(headers, ['GIÁ BÁN','GIA BAN','SALE','GIÁ KHÁCH','GIA KHACH']);
      const idxNote = headerIndex(headers, ['GHI CHÚ','GHI CHU','NOTE','LƯU Ý','LUU Y']);
      if(idxName < 0) throw new Error(`Sheet "${sheetName}" thiếu cột LOẠI VÉ.`);
      const now = new Date().toISOString();
      return rows.slice(headerRowIndex+1).map(row => {
        const name = String(row[idxName] || '').trim(); if(!name) return null;
        return {id:id(),name,category:sheetName || 'Chưa phân loại',type:idxType >= 0 ? String(row[idxType] || '').trim() : '',supplierId:'',unit:'vé',publicPrice:idxPublic >= 0 ? parseMoney(row[idxPublic]) : 0,defaultCost:idxCost >= 0 ? parseMoney(row[idxCost]) : 0,ctvPrice:idxCtv >= 0 ? parseMoney(row[idxCtv]) : 0,defaultPrice:idxSale >= 0 ? parseMoney(row[idxSale]) : 0,note:idxNote >= 0 ? String(row[idxNote] || '').trim() : '',createdAt:now,updatedAt:now};
      }).filter(Boolean);
    }

    function downloadProductTemplateCsv(){
      const rows = [
        ['LOẠI VÉ','PHÂN LOẠI','GIÁ CÔNG BỐ','GIÁ NHẬP','CTV','GIÁ BÁN','GHI CHÚ'],
        ['Vé người lớn','Người lớn','1000000','850000','900000','950000','Áp dụng ngày thường'],
        ['Vé trẻ em','Trẻ em','800000','650000','700000','750000','Cao dưới 1m miễn phí nếu có']
      ];
      download('mau_nhap_san_pham_ve.csv', rows.map(r=>r.map(csvEscape).join(',')).join('\n'), 'text/csv;charset=utf-8');
    }

    function getReportCategoryData(orders=filteredOrders()){
      const map = new Map();
      orders.forEach(o=>normalizeOrderItems(o).forEach(item=>{
        const p = getProduct(item.productId);
        const category = p?.category || item.category || 'Khác';
        const qty = Number(item.quantity||0), sale=Number(item.salePrice||0), cost=Number(item.costPrice||0), discount=Number(item.discount||0);
        const revenue = Math.max(0, qty*sale - discount);
        const profit = revenue - Math.max(0, qty*cost);
        const cur = map.get(category) || {category, revenue:0, profit:0};
        cur.revenue += revenue; cur.profit += profit; map.set(category, cur);
      }));
      return [...map.values()].sort((a,b)=>b.revenue-a.revenue);
    }
    function pieChartHtml(title, rows, key){
      const positive = rows.map(r=>({name:r.category, value:Math.max(0, Number(r[key]||0))})).filter(r=>r.value>0);
      const total = positive.reduce((s,r)=>s+r.value,0);
      if(!total) return `<div class="pie-card"><h3>${escapeHtml(title)}</h3><div class="empty">Chưa có dữ liệu để vẽ biểu đồ.</div></div>`;
      let acc=0;
      const stops = positive.map((r,i)=>{ const start=acc/total*100; acc+=r.value; const end=acc/total*100; return `${PIE_COLORS[i%PIE_COLORS.length]} ${start.toFixed(2)}% ${end.toFixed(2)}%`; }).join(',');
      const legend = positive.map((r,i)=>`<div class="legend-item"><span class="legend-dot" style="background:${PIE_COLORS[i%PIE_COLORS.length]}"></span><span>${escapeHtml(r.name)}</span><span class="legend-value">${currency(r.value)}</span></div>`).join('');
      return `<div class="pie-card"><h3>${escapeHtml(title)}</h3><div class="pie-wrap"><div class="pie-chart" style="background:conic-gradient(${stops})"></div><div class="pie-legend">${legend}</div></div></div>`;
    }
    function renderReport(){
      const orders=filteredOrders(), expenses=filteredExpenses(), s=getSummary(orders,expenses), categoryData=getReportCategoryData(orders);
      const totalRatioData = [
        {category:'Doanh thu tổng', value: Math.max(0, Number(s.revenue||0))},
        {category:'Lợi nhuận thực', value: Math.max(0, Number(s.netProfit||0))}
      ];
      document.getElementById('report-section').innerHTML = `${dateToolbar()}<div class="grid kpi"><div class="card kpi-card"><div class="kpi-label">Doanh thu</div><div class="kpi-value">${currency(s.revenue)}</div></div><div class="card kpi-card"><div class="kpi-label">Giá vốn</div><div class="kpi-value">${currency(s.cost)}</div></div><div class="card kpi-card"><div class="kpi-label">Chi phí</div><div class="kpi-value">${currency(s.expenses)}</div></div><div class="card kpi-card"><div class="kpi-label">Lợi nhuận thực</div><div class="kpi-value">${currency(s.netProfit)}</div></div></div><div class="chart-grid">${pieChartHtml('Biểu đồ tròn tỉ lệ doanh thu và lợi nhuận tổng', totalRatioData, 'value')}${pieChartHtml('Biểu đồ tròn tỉ lệ doanh thu theo danh mục', categoryData, 'revenue')}${pieChartHtml('Biểu đồ tròn tỉ lệ lợi nhuận theo danh mục', categoryData, 'profit')}</div><div class="card" style="margin-top:16px"><div class="toolbar"><button class="btn" onclick="exportReportCsv()">Xuất CSV báo cáo</button></div>${ordersTable(orders)}</div>`;
    }

    function downloadBlob(filename, blob){ const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); }
    function makeS1aXlsx(options){
      const enc = new TextEncoder();
      const crcTable = (()=>{ const t=[]; for(let n=0;n<256;n++){ let c=n; for(let k=0;k<8;k++) c = c&1 ? 0xEDB88320 ^ (c>>>1) : c>>>1; t[n]=c>>>0; } return t; })();
      const crc32 = bytes => { let c=0xffffffff; for(const b of bytes) c=crcTable[(c^b)&0xff]^(c>>>8); return (c^0xffffffff)>>>0; };
      const u16 = n => [n&255,(n>>>8)&255]; const u32 = n => [n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255]; const dosTime=()=>[0,0,33,92];
      const xmlEscape = (s='') => String(s).replace(/[&<>\"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
      const inlineCell=(ref,value,style=0)=>`<c r="${ref}" s="${style}" t="inlineStr"><is><t>${xmlEscape(value)}</t></is></c>`; const numCell=(ref,value,style=0)=>`<c r="${ref}" s="${style}"><v>${Number(value||0)}</v></c>`;
      const makeZip = files => { const local=[]; const central=[]; let offset=0; files.forEach(f=>{ const nameBytes=enc.encode(f.name); const dataBytes=enc.encode(f.content); const crc=crc32(dataBytes); const time=dosTime(); const lh=[...u32(0x04034b50),...u16(20),...u16(0),...u16(0),...time,...u32(crc),...u32(dataBytes.length),...u32(dataBytes.length),...u16(nameBytes.length),...u16(0),...nameBytes,...dataBytes]; local.push(new Uint8Array(lh)); const ch=[...u32(0x02014b50),...u16(20),...u16(20),...u16(0),...u16(0),...time,...u32(crc),...u32(dataBytes.length),...u32(dataBytes.length),...u16(nameBytes.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(offset),...nameBytes]; central.push(new Uint8Array(ch)); offset += lh.length; }); const centralSize=central.reduce((s,b)=>s+b.length,0); const centralOffset=offset; const end=new Uint8Array([...u32(0x06054b50),...u16(0),...u16(0),...u16(files.length),...u16(files.length),...u32(centralSize),...u32(centralOffset),...u16(0)]); return new Blob([...local,...central,end],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}); };
      const {rows, settings, from, to, total} = options;
      const sheetRows=[];
      sheetRows.push(`<row r="1">${inlineCell('A1',settings.businessName||'Hộ kinh doanh',1)}${inlineCell('C1','Mẫu số S1a-HKD',1)}</row>`);
      sheetRows.push(`<row r="2">${inlineCell('A2',settings.address||'',0)}${inlineCell('C2','(Ban hành theo Thông tư 152/2025/TT-BTC)',0)}</row>`);
      sheetRows.push(`<row r="3">${inlineCell('A3','Mã số thuế: '+(settings.taxCode||''),0)}</row>`);
      sheetRows.push(`<row r="5">${inlineCell('A5','SỔ DOANH THU BÁN HÀNG HÓA, DỊCH VỤ',2)}</row>`);
      sheetRows.push(`<row r="6">${inlineCell('A6',`Kỳ: từ ${from||''} đến ${to||''}`,1)}</row>`);
      sheetRows.push(`<row r="7">${inlineCell('A7','Địa điểm kinh doanh: '+(settings.businessLocation||settings.address||''),1)}</row>`);
      sheetRows.push(`<row r="9" ht="30" customHeight="1">${inlineCell('A9','Ngày, tháng ghi sổ',3)}${inlineCell('B9','Diễn giải',3)}${inlineCell('C9','Số tiền',3)}</row>`);
      sheetRows.push(`<row r="10">${inlineCell('A10','A',3)}${inlineCell('B10','B',3)}${inlineCell('C10','1',3)}</row>`);
      let rowNum=11;
      rows.forEach(row=>{ sheetRows.push(`<row r="${rowNum}" ht="31.5" customHeight="1">${inlineCell('A'+rowNum,row.date,4)}${inlineCell('B'+rowNum,row.desc||row.description,4)}${numCell('C'+rowNum,row.amount,5)}</row>`); rowNum++; });
      const totalRow=rowNum;
      sheetRows.push(`<row r="${totalRow}" ht="24" customHeight="1">${inlineCell('A'+totalRow,'',4)}${inlineCell('B'+totalRow,'Cộng',3)}${numCell('C'+totalRow,total,6)}</row>`);
      sheetRows.push(`<row r="${totalRow+2}">${inlineCell('C'+(totalRow+2),'Ngày ..... tháng ..... năm ......',7)}</row>`);
      sheetRows.push(`<row r="${totalRow+3}">${inlineCell('C'+(totalRow+3),'NGƯỜI ĐẠI DIỆN HỘ KINH DOANH',1)}</row>`);
      sheetRows.push(`<row r="${totalRow+4}">${inlineCell('C'+(totalRow+4),'(Ký, ghi rõ họ tên)',7)}</row>`);
      sheetRows.push(`<row r="${totalRow+7}">${inlineCell('C'+(totalRow+7),settings.ownerName||'',1)}</row>`);
      const lastRow=totalRow+7;
      const styles=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0"/></numFmts><fonts count="4"><font><sz val="11"/><name val="Arial"/></font><font><b/><sz val="11"/><name val="Arial"/></font><font><b/><sz val="14"/><name val="Arial"/></font><font><i/><sz val="11"/><name val="Arial"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="3"><border/><border><left style="thin"/><right style="thin"/><top style="thin"/><bottom style="thin"/></border><border><bottom style="thin"/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="8"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="right" vertical="top"/></xf><xf numFmtId="164" fontId="1" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf><xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
      const sheetXml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><dimension ref="A1:C${lastRow}"/><sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols><col min="1" max="1" width="24" customWidth="1"/><col min="2" max="2" width="84" customWidth="1"/><col min="3" max="3" width="22" customWidth="1"/></cols><sheetData>${sheetRows.join('')}</sheetData><mergeCells count="4"><mergeCell ref="C1:C3"/><mergeCell ref="A5:C5"/><mergeCell ref="A6:C6"/><mergeCell ref="A7:C7"/></mergeCells><printOptions horizontalCentered="1"/><pageMargins left="0.3" right="0.3" top="0.7" bottom="0.7" header="0.3" footer="0.3"/><pageSetup paperSize="9" orientation="landscape"/></worksheet>`;
      const files=[
        {name:'[Content_Types].xml',content:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`},
        {name:'_rels/.rels',content:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`},
        {name:'xl/workbook.xml',content:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Mẫu số S1a-HKD" sheetId="1" r:id="rId1"/></sheets></workbook>`},
        {name:'xl/_rels/workbook.xml.rels',content:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`},
        {name:'xl/worksheets/sheet1.xml',content:sheetXml},{name:'xl/styles.xml',content:styles},{name:'docProps/core.xml',content:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>Sổ S1a-HKD</dc:title><dc:creator>Sổ Doanh Thu HKD</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created></cp:coreProperties>`},{name:'docProps/app.xml',content:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Sổ Doanh Thu HKD</Application></Properties>`}
      ];
      return makeZip(files);
    }
    function exportS1aExcel(){ const rows=s1aRows(); const total=rows.reduce((s,r)=>s+r.amount,0); const blob=makeS1aXlsx({rows,total,settings:db.settings,from:reportRange.from,to:reportRange.to}); downloadBlob(`S1a-HKD_${reportRange.from}_${reportRange.to}.xlsx`, blob); }
    function renderS1a(){ document.getElementById('reportS1a-section').innerHTML = `${dateToolbar()}<div class="card print-area"><div class="toolbar no-print"><button class="btn green" onclick="exportS1aExcel()">Xuất .xlsx S1a-HKD</button><button class="btn" onclick="printS1a()">In / Lưu PDF</button><a class="btn gray" href="templates/Sa01-HKD.xlsx" download>Tải file mẫu gốc</a></div><div class="hint" style="margin-bottom:10px">File xuất ra là .xlsx; cột Số tiền được ghi dạng số với định dạng #,##0 để không lỗi hiển thị/cộng tiền trong Excel.</div><div class="s1a-preview">${s1aHtml()}</div></div>`; document.getElementById('print-section').innerHTML = `<div class="s1a-preview">${s1aHtml()}</div>`; }

    function captureActiveInputState(){
      const el = document.activeElement;
      if(!el || !['INPUT','TEXTAREA','SELECT'].includes(el.tagName)) return null;
      const id = el.id || '';
      const name = el.getAttribute('name') || '';
      const isFilter = id.includes('filter') || id.includes('search');
      if(!isFilter) return null;
      return {
        id,
        name,
        value: 'value' in el ? el.value : '',
        selectionStart: typeof el.selectionStart === 'number' ? el.selectionStart : null,
        selectionEnd: typeof el.selectionEnd === 'number' ? el.selectionEnd : null
      };
    }
    function restoreActiveInputState(state){
      if(!state || !state.id) return;
      setTimeout(()=>{
        const el = document.getElementById(state.id);
        if(!el) return;
        if('value' in el) el.value = state.value;
        try { el.focus({preventScroll:true}); } catch { el.focus(); }
        if(typeof el.setSelectionRange === 'function' && state.selectionStart !== null){
          try { el.setSelectionRange(state.selectionStart, state.selectionEnd); } catch {}
        }
      }, 0);
    }
    function rememberTypingValue(el){
      // Chỉ ghi nhớ giá trị đang gõ, không render lại giao diện.
      // Việc tìm kiếm chỉ chạy khi bấm nút Tìm kiếm hoặc nhấn Enter.
      if(!el || !el.id) return;
      window.__lastTypingFilterValue = window.__lastTypingFilterValue || {};
      window.__lastTypingFilterValue[el.id] = el.value;
    }
    function handleSearchKey(event, type){
      if(event.key !== 'Enter') return;
      event.preventDefault();
      event.stopPropagation();
      if(type === 'orders') applyOrderFilters();
      if(type === 'products') applyProductFilters();
      if(type === 'customers') applyCustomerSearch();
      if(type === 'suppliers') applySupplierSearch();
    }
    function render(){
      const focusState = captureActiveInputState();
      setTitle();
      renderDashboard();
      renderOrders();
      renderProducts();
      renderCustomers();
      renderSuppliers();
      renderExpenses();
      renderReport();
      renderS1a();
      renderSettings();
      restoreActiveInputState(focusState);
    }
    initNav(); render(); loadDataFromSQLite();
  