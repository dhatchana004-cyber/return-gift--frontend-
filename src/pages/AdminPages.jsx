import { useEffect, useRef, useState } from 'react';
import api, { getErrorMessage } from '../services/api';
import defaultHeroGiftImg from '../assets/boutique-hero-gifts.png';

function useAdminData(path) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const reload = async () => {
    setLoading(true);
    try { setData((await api.get(path)).data); setError(''); }
    catch (e) { setError(getErrorMessage(e)); }
    finally { setLoading(false); }
  };
  useEffect(() => { reload(); }, [path]);
  return { data, error, loading, reload, setError };
}

function AdminFeedback({ error, notice }) {
  return <>{error && <div className="alert alert-danger">{error}</div>}{notice && <div className="alert alert-success">{notice}</div>}</>;
}

export function AdminOverviewPage() {
  const { data, error, loading } = useAdminData('/admin/overview');
  if (loading || !data) return <><AdminFeedback error={error} /><p className="loading-copy">Gathering your studio's latest...</p></>;
  return <><AdminFeedback error={error} /><div className="metric-grid">{[
    ['Total sales', `₹${Number(data.metrics.total_sales).toLocaleString('en-IN')}`, 'bi-currency-rupee'],
    ['All orders', data.metrics.total_orders, 'bi-receipt'],
    ['Customers', data.metrics.total_customers, 'bi-people'],
    ['Active products', data.metrics.active_products, 'bi-box-seam'],
    ['Pending orders', data.metrics.open_orders, 'bi-hourglass-split'],
    ['New quote inquiries', data.metrics.new_inquiries, 'bi-envelope-paper']
  ].map(([label, value, icon]) => <div className="metric-card" key={label}><span className="metric-icon"><i className={`bi ${icon}`} /></span><span>{label}</span><strong>{value}</strong></div>)}</div>
    <div className="admin-section-card"><div className="admin-card-heading"><div><p className="eyebrow">FRESH FROM THE STUDIO</p><h3>Recent orders</h3></div><a href="/admin/orders" className="text-link">All orders →</a></div>
      {data.recentOrders.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Order</th><th>Customer</th><th>Date</th><th>Status</th><th>Total</th></tr></thead><tbody>{data.recentOrders.map((order) => <tr key={order.id}><td>#{order.id}</td><td>{order.customer_name}<small>{order.customer_email}</small></td><td>{new Date(order.created_at).toLocaleDateString('en-IN')}</td><td><span className={`status-pill status-${order.status}`}>{order.status}</span></td><td>₹{Number(order.subtotal).toLocaleString('en-IN')}</td></tr>)}</tbody></table></div> : <div className="admin-empty">Your first order will appear here.</div>}
    </div><div className="admin-notice"><i className="bi bi-info-circle" /><span><strong>{data.metrics.low_stock} products</strong> have five or fewer items in stock, and <strong>{data.metrics.open_orders} orders</strong> need attention.</span></div>
  </>;
}

const emptyProduct = { name: '', categoryId: '', description: '', price: '', offerPercentage: '0', stock: '0', isCustomizable: false, isTrending: false, isActive: true };

export function AdminProductsPage() {
  const { data, error, loading, reload, setError } = useAdminData('/admin/products');
  const categoryState = useAdminData('/admin/categories');
  const [form, setForm] = useState(emptyProduct);
  const [editing, setEditing] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [files, setFiles] = useState([]);
  const [existingImages, setExistingImages] = useState([]);
  const [deletingImageId, setDeletingImageId] = useState(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const offerInputRef = useRef(null);
  const products = data?.products || [];
  const categories = categoryState.data?.categories || [];
  const edit = (product) => {
    setEditing(product.id);
    setFormOpen(true);
    setForm({
      name: product.name,
      categoryId: product.category_id || '',
      description: product.description,
      price: product.price,
      offerPercentage: String(product.offer_percentage || 0),
      stock: product.stock,
      isCustomizable: product.is_customizable,
      isTrending: Boolean(product.is_trending),
      isActive: product.is_active,
    });
    setFiles([]);
    setExistingImages(product.images || []);
    setNotice('');
  };
  const editOffer = (product) => {
    edit(product);
    window.setTimeout(() => {
      offerInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      offerInputRef.current?.focus();
    }, 0);
  };
  const toggleTrending = async (product) => {
    setError(''); setNotice('');
    try {
      await api.post(`/admin/products/${product.id}/trending`);
      setNotice(`"${product.name}" trending status updated.`);
      await reload();
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };
  const reset = () => { setForm(emptyProduct); setEditing(null); setFiles([]); setExistingImages([]); setFormOpen(false); };
  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      const payload = {
        ...form,
        categoryId: form.categoryId ? Number(form.categoryId) : null,
        price: Number(form.price),
        offerPercentage: Number(form.offerPercentage),
        stock: Number(form.stock),
        isTrending: Boolean(form.isTrending),
      };
      const response = editing ? await api.patch(`/admin/products/${editing}`, payload) : await api.post('/admin/products', payload);
      const product = response.data.product;
      if (files.length) {
        const upload = new FormData();
        Array.from(files).slice(0, 5).forEach((file) => upload.append('images', file));
        await api.post(`/admin/products/${product.id}/images`, upload);
      }
      setNotice(editing ? 'Product changes saved.' : 'Product added to your collection.');
      reset(); await reload();
    } catch (e) { setError(getErrorMessage(e)); }
    finally { setBusy(false); }
  };
  const removeImage = async (image) => {
    if (!editing || !window.confirm('Delete this product image? This cannot be undone.')) return;
    setDeletingImageId(image.id); setError(''); setNotice('');
    try {
      const { data: response } = await api.delete(`/admin/products/${editing}/images/${image.id}`);
      setExistingImages(response.images);
      setError(response.warning || '');
      setNotice('Product image deleted.');
      await reload();
    } catch (e) { setError(getErrorMessage(e)); }
    finally { setDeletingImageId(null); }
  };
  const remove = async (product) => {
    if (!window.confirm(`Remove "${product.name}" from the storefront?`)) return;
    setError(''); setNotice('');
    try { await api.delete(`/admin/products/${product.id}`); setNotice('Product removed from the storefront.'); await reload(); }
    catch (e) { setError(getErrorMessage(e)); }
  };
  return <><div className="admin-page-heading"><div><p className="eyebrow">YOUR COLLECTION</p><h1>Products</h1></div><div className="admin-product-heading-actions"><span>{products.length} total</span><button type="button" className="button button-dark" aria-expanded={formOpen} aria-controls="admin-product-form" onClick={() => { if (formOpen) reset(); else setFormOpen(true); }}>{formOpen ? 'Close form' : 'Add product'} <i className={`bi ${formOpen ? 'bi-x-lg' : 'bi-plus-lg'}`} /></button></div></div><AdminFeedback error={error || categoryState.error} notice={notice} />
    {formOpen && <form id="admin-product-form" className="admin-form-card" onSubmit={submit}><div className="admin-card-heading"><h3>{editing ? 'Edit this keepsake' : 'Add something lovely'}</h3>{editing && <button type="button" className="text-button" onClick={reset}>Cancel edit</button>}</div>
      <div className="admin-product-form"><label>Product name<input required minLength="2" maxLength="180" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label><label>Occasion<select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}><option value="">Choose category</option>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label><label>Price (₹)<input required type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></label><label className="admin-offer-field">Offer percentage<input ref={offerInputRef} required type="number" min="0" max="100" step="1" value={form.offerPercentage} onChange={(e) => setForm({ ...form, offerPercentage: e.target.value })} /><span className="optional">Set to 0 to remove the offer.</span></label><label>Available stock<input required type="number" min="0" step="1" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} /></label><label className="admin-form-span">Description<textarea required minLength="10" maxLength="5000" rows="3" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>{editing && existingImages.length > 0 && <div className="admin-form-span"><span className="admin-image-label">Current product images</span><div className="admin-image-list">{existingImages.map((image) => <div className="admin-image-item" key={image.id}><img src={image.url} alt={image.alt_text || form.name} /><button type="button" className="danger-link" disabled={deletingImageId === image.id} onClick={() => removeImage(image)}>{deletingImageId === image.id ? 'Deleting…' : 'Delete image'} <i className="bi bi-trash" /></button></div>)}</div></div>}<label className="admin-form-span">Product images <span className="optional">(up to 5, max 5 MB each)</span><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple onChange={(e) => setFiles(e.target.files)} /></label><label className="admin-check"><input type="checkbox" checked={form.isCustomizable} onChange={(e) => setForm({ ...form, isCustomizable: e.target.checked })} /> Supports printed names / gift messages</label><label className="admin-check"><input type="checkbox" checked={form.isTrending} onChange={(e) => setForm({ ...form, isTrending: e.target.checked })} /> <strong>Make as Trending</strong> (Feature in the homepage Trending Now section)</label>{editing && <label className="admin-check"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Visible in the storefront</label>}</div>
      <button className="button button-dark" disabled={busy}>{busy ? 'Saving...' : editing ? 'Save changes' : 'Add product'} <i className="bi bi-arrow-right" /></button>
    </form>}
    <div className="admin-section-card"><div className="admin-card-heading"><h3>All products</h3></div>{loading ? <p className="loading-copy">Loading products...</p> : products.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Product</th><th>Occasion</th><th>Price</th><th>Offer</th><th>Stock</th><th>Trending</th><th>Visibility</th><th>Actions</th></tr></thead><tbody>{products.map((product) => <tr key={product.id}><td>{product.name}{product.is_customizable && <small>Personalizable</small>}</td><td>{product.category_name || '—'}</td><td>₹{Number(product.price).toLocaleString('en-IN')}</td><td>{product.offer_percentage > 0 ? `${product.offer_percentage}% OFF` : '—'}</td><td>{product.stock}</td><td><button type="button" className={`admin-trending-badge ${product.is_trending ? 'active' : ''}`} onClick={() => toggleTrending(product)} title="Click to toggle trending">{product.is_trending ? '★ Trending' : '☆ Make Trending'}</button></td><td><span className={`status-pill ${product.is_active ? 'status-delivered' : 'status-cancelled'}`}>{product.is_active ? 'Active' : 'Hidden'}</span></td><td className="table-actions"><button onClick={() => edit(product)}>Edit</button><button onClick={() => editOffer(product)}>{product.offer_percentage > 0 ? 'Edit offer' : 'Offer'}</button><button className="danger-link" onClick={() => remove(product)}>Remove</button></td></tr>)}</tbody></table></div> : <div className="admin-empty">No products yet. Add your first keepsake above.</div>}</div>
  </>;
}

export function AdminOrdersPage() {
  const { data, error, loading, reload, setError } = useAdminData('/admin/orders');
  const [notice, setNotice] = useState('');
  const [expanded, setExpanded] = useState(null);
  const updateStatus = async (id, status) => {
    setError(''); setNotice('');
    try { await api.patch(`/admin/orders/${id}/status`, { status }); setNotice(`Order #${id} updated.`); await reload(); }
    catch (e) { setError(getErrorMessage(e)); }
  };
  return <><div className="admin-page-heading"><div><p className="eyebrow">FROM CHECKOUT TO THEIR DOOR</p><h1>Orders</h1></div><span>{data?.orders.length || 0} orders</span></div><AdminFeedback error={error} notice={notice} /><div className="admin-section-card">{loading ? <p className="loading-copy">Loading orders...</p> : data?.orders.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Order</th><th>Customer</th><th>Placed</th><th>Total</th><th>Payment</th><th>Status</th><th>Details</th></tr></thead><tbody>{data.orders.map((order) => <tr key={order.id}><td>#{order.id}</td><td>{order.customer_name}<small>{order.customer_email}<br />{order.customer_phone}</small></td><td>{new Date(order.created_at).toLocaleDateString('en-IN')}</td><td>₹{Number(order.total || order.subtotal).toLocaleString('en-IN')}</td><td>{order.payment_method === 'cash_on_delivery' ? 'Cash on delivery' : order.payment_method === 'razorpay' ? 'Razorpay' : order.payment_method}<small>{order.payment_status}</small></td><td><select className="status-select" value={order.status} onChange={(e) => updateStatus(order.id, e.target.value)}>{['pending','confirmed','processing','shipped','delivered','cancelled'].map((status) => <option key={status} value={status}>{status}</option>)}</select></td><td><button className="text-button" onClick={() => setExpanded(expanded === order.id ? null : order.id)}>{expanded === order.id ? 'Hide' : 'View'}</button>{expanded === order.id && <div className="order-detail-pop"><strong>Deliver to</strong><p>{order.shipping_address.fullName}<br />{order.shipping_address.addressLine1}<br />{order.shipping_address.addressLine2}<br />{order.shipping_address.city}, {order.shipping_address.state} {order.shipping_address.postalCode}<br />{order.shipping_address.country}<br />{order.shipping_address.phone}</p><strong>Items</strong>{order.items.map((item, index) => <p key={index}>{item.name} × {item.quantity}{item.printedName && ` · ${item.printedName}`}{item.giftMessage && ` · “${item.giftMessage}”`}</p>)}{order.notes && <p><strong>Note:</strong> {order.notes}</p>}</div>}</td></tr>)}</tbody></table></div> : <div className="admin-empty">Your orders will appear here.</div>}</div></>;
}

export function AdminCustomersPage() {
  const { data, error, loading } = useAdminData('/admin/customers');
  return <><div className="admin-page-heading"><div><p className="eyebrow">THE PEOPLE BEHIND THE PARTIES</p><h1>Customers</h1></div><span>{data?.customers.length || 0} lovely people</span></div><AdminFeedback error={error} />{loading ? <p className="loading-copy">Loading customers...</p> : <div className="admin-section-card"><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Customer</th><th>Phone</th><th>Joined</th><th>Orders</th><th>Total spent</th></tr></thead><tbody>{data?.customers.map((customer) => <tr key={customer.id}><td>{customer.name}<small>{customer.email}</small></td><td>{customer.phone || '—'}</td><td>{new Date(customer.created_at).toLocaleDateString('en-IN')}</td><td>{customer.order_count}</td><td>₹{Number(customer.total_spent).toLocaleString('en-IN')}</td></tr>)}</tbody></table></div></div>}</>;
}

export function AdminMessagesPage() {
  const { data, error, loading } = useAdminData('/admin/messages');
  return <><div className="admin-page-heading"><div><p className="eyebrow">NOTES FROM YOUR COMMUNITY</p><h1>Messages</h1></div><span>{data?.messages.length || 0} messages</span></div><AdminFeedback error={error} />{loading ? <p className="loading-copy">Gathering your messages...</p> : data?.messages.length ? <div className="message-list">{data.messages.map((message) => <article className="message-card" key={message.id}><div><div><h3>{message.name}</h3><a href={`mailto:${message.email}`}>{message.email}</a>{message.phone && <p>{message.phone}</p>}</div><time>{new Date(message.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</time></div><p>{message.message}</p><a className="text-link" href={`mailto:${message.email}?subject=${encodeURIComponent('VEDHIKA BRAND enquiry')}`}>Reply by email <i className="bi bi-arrow-up-right" /></a></article>)}</div> : <div className="admin-section-card admin-empty">New contact form messages will appear here.</div>}</>;
}

export function AdminQuotationsPage() {
  const { data, error, loading, reload, setError } = useAdminData('/admin/quotations');
  const [notice, setNotice] = useState('');
  const updateStatus = async (id, status) => {
    setError('');
    setNotice('');
    try {
      await api.patch(`/admin/quotations/${id}/status`, { status });
      setNotice(`Inquiry #${id} updated.`);
      await reload();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  };
  return <><div className="admin-page-heading"><div><p className="eyebrow">BESPOKE EVENTS & BULK ORDERS</p><h1>Quote inquiries</h1></div><span>{data?.quotations.length || 0} inquiries</span></div><AdminFeedback error={error} notice={notice} />{loading ? <p className="loading-copy">Gathering quote inquiries...</p> : data?.quotations.length ? <div className="message-list">{data.quotations.map((quote) => <article className="message-card quotation-card" key={quote.id}><div><div><h3>{quote.fullName}</h3><a href={`mailto:${quote.email}`}>{quote.email}</a><p>{quote.phone}</p></div><div className="quotation-status"><time>{new Date(quote.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</time><select className="status-select" value={quote.status} onChange={(event) => updateStatus(quote.id, event.target.value)} aria-label={`Update inquiry ${quote.id} status`}>{['new', 'contacted', 'quoted', 'closed'].map((status) => <option value={status} key={status}>{status}</option>)}</select></div></div><p><strong>{quote.eventType.replaceAll('_', ' ')} · {quote.estimatedQuantity} guests</strong><br />Budget: {quote.budgetRange || 'Not specified'} · Date: {quote.eventDate || 'Not specified'}<br />Delivery: {quote.deliveryLocation}</p>{quote.additionalDetails && <p>{quote.additionalDetails}</p>}<a className="text-link" href={`mailto:${quote.email}?subject=${encodeURIComponent('VEDHIKA BRAND · your gifting inquiry')}`}>Reply by email <i className="bi bi-arrow-up-right" /></a></article>)}</div> : <div className="admin-section-card admin-empty">New quote inquiries will appear here.</div>}</>;
}

export function AdminCategoriesPage() {
  const { data, error, loading, reload, setError } = useAdminData('/admin/categories');
  const [form, setForm] = useState({ name: '', description: '', is_trending: false });
  const [imageFile, setImageFile] = useState(null);
  const [uploadingId, setUploadingId] = useState(null);
  const [togglingId, setTogglingId] = useState(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState({});
  const createFileRef = useRef(null);

  const create = async (event) => {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      const payload = new FormData();
      payload.append('name', form.name.trim());
      payload.append('description', form.description.trim());
      payload.append('is_trending', form.is_trending ? 'true' : 'false');
      if (imageFile) payload.append('image', imageFile);
      await api.post('/admin/categories', payload);
      setForm({ name: '', description: '', is_trending: false });
      setImageFile(null);
      if (createFileRef.current) createFileRef.current.value = '';
      setNotice('Category added.');
      await reload();
    } catch (e) { setError(getErrorMessage(e)); }
    finally { setBusy(false); }
  };

  const uploadCategoryImage = async (category, file) => {
    if (!file) return;
    setUploadingId(category.id); setError(''); setNotice('');
    try {
      const payload = new FormData();
      payload.append('image', file);
      await api.post(`/admin/categories/${category.id}/image`, payload);
      setNotice(`Image updated for "${category.name}".`);
      await reload();
    } catch (e) { setError(getErrorMessage(e)); }
    finally { setUploadingId(null); }
  };

  const toggleCategoryTrending = async (category) => {
    setTogglingId(category.id); setError(''); setNotice('');
    try {
      const { data: res } = await api.post(`/admin/categories/${category.id}/trending`);
      setNotice(`"${category.name}" ${res.category?.is_trending ? 'added to' : 'removed from'} Trending Now.`);
      await reload();
    } catch (e) { setError(getErrorMessage(e)); }
    finally { setTogglingId(null); }
  };

  const save = async (id) => {
    setError(''); setNotice('');
    try {
      await api.patch(`/admin/categories/${id}`, editing[id] || {});
      setNotice('Category updated.');
      await reload();
    } catch (e) { setError(getErrorMessage(e)); }
  };

  const remove = async (category) => {
    if (!window.confirm(`Delete "${category.name}"? Products in this category will remain in your catalog.`)) return;
    try { await api.delete(`/admin/categories/${category.id}`); setNotice('Category deleted.'); await reload(); }
    catch (e) { setError(getErrorMessage(e)); }
  };

  return <><div className="admin-page-heading"><div><p className="eyebrow">OCCASIONS & BOUTIQUE COLLECTIONS</p><h1>Categories</h1></div></div><AdminFeedback error={error} notice={notice} />
    <form className="admin-form-card category-create" onSubmit={create}>
      <h3>Add a category</h3>
      <div className="category-form-row">
        <label>Category name<input required minLength="2" maxLength="100" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Return Gifts" /></label>
        <label>Upload image <span className="optional">(JPG/PNG/WEBP, max 5 MB)</span><input ref={createFileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(e) => setImageFile(e.target.files?.[0] || null)} /></label>
        <label>Description<input maxLength="1000" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Brief description" /></label>
        <button className="button button-dark" disabled={busy}>{busy ? 'Adding...' : 'Add category'}</button>
      </div>
      <label className="admin-check" style={{ marginTop: 12 }}>
        <input type="checkbox" checked={form.is_trending} onChange={(e) => setForm({ ...form, is_trending: e.target.checked })} />
        <strong>Show in Trending Now</strong> (Feature this category on homepage Trending Now)
      </label>
    </form>
    <div className="admin-section-card">
      <h3>Manage occasions & categories</h3>
      {loading ? <p className="loading-copy">Loading categories...</p> : (data?.categories || []).map((category) => (
        <div className="category-admin-row" key={category.id}>
          <div className="category-admin-thumb">
            {category.image_url ? (
              <img src={category.image_url} alt={category.name} />
            ) : (
              <span>{category.name.charAt(0)}</span>
            )}
          </div>
          <label>Name<input value={editing[category.id]?.name ?? category.name} onChange={(e) => setEditing({ ...editing, [category.id]: { ...editing[category.id], name: e.target.value } })} /></label>
          <label>Description<input value={editing[category.id]?.description ?? category.description ?? ''} onChange={(e) => setEditing({ ...editing, [category.id]: { ...editing[category.id], description: e.target.value } })} /></label>
          <label className="category-upload-btn" title="Upload new category image">
            <i className="bi bi-cloud-arrow-up" /> {uploadingId === category.id ? 'Uploading…' : 'Upload Image'}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              disabled={uploadingId === category.id}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) uploadCategoryImage(category, file);
              }}
            />
          </label>
          <button
            type="button"
            className={`admin-trending-badge ${category.is_trending ? 'active' : ''}`}
            disabled={togglingId === category.id}
            onClick={() => toggleCategoryTrending(category)}
            title="Show/hide in homepage Trending Now section"
          >
            {category.is_trending ? '★ Trending Now' : '☆ Trending Now'}
          </button>
          <span>{category.product_count} products</span>
          <div className="category-admin-actions">
            <button type="button" className="text-button" onClick={() => save(category.id)}>Save</button>
            <button type="button" className="text-button danger-link" onClick={() => remove(category)}>Delete</button>
          </div>
        </div>
      ))}
    </div>
  </>;
}

export function AdminDeliveryChargeSettingsPage() {
  const { data, error, loading, reload, setError } = useAdminData('/admin/delivery-charge-settings');
  const [enabled, setEnabled] = useState(true);
  const [defaultCharge, setDefaultCharge] = useState('50.00');
  const [districts, setDistricts] = useState([]);
  const [search, setSearch] = useState('');
  const [flatRateInput, setFlatRateInput] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!data) return;
    setEnabled(data.enabled !== false);
    setDefaultCharge(data.default_charge || '50.00');
    if (data.districts) setDistricts(data.districts);
  }, [data]);

  const updateDistrictCharge = (id, newCharge) => {
    setDistricts((prev) =>
      prev.map((d) => (d.id === id ? { ...d, charge: newCharge } : d))
    );
  };

  const toggleDistrictActive = (id) => {
    setDistricts((prev) =>
      prev.map((d) => (d.id === id ? { ...d, is_active: !d.is_active } : d))
    );
  };

  const applyFlatRate = (e) => {
    e.preventDefault();
    const rate = parseFloat(flatRateInput);
    if (isNaN(rate) || rate < 0) {
      setError('Please enter a valid amount (e.g. 50 or 60).');
      return;
    }
    setDistricts((prev) => prev.map((d) => ({ ...d, charge: rate.toFixed(2) })));
    setNotice(`Updated all 38 districts to ₹${rate.toFixed(2)}. Click "Save All Settings" to confirm.`);
  };

  const save = async (event) => {
    event.preventDefault();
    setBusy(true); setError(''); setNotice('');
    try {
      await api.put('/admin/delivery-charge-settings', {
        enabled,
        default_charge: defaultCharge,
        district_charges: districts,
      });
      setNotice('Tamil Nadu district delivery charges saved successfully!');
      await reload();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setBusy(false);
    }
  };

  const filteredDistricts = districts.filter((d) =>
    d.name.toLowerCase().includes(search.trim().toLowerCase())
  );

  return (
    <>
      <div className="admin-page-heading">
        <div>
          <p className="eyebrow">TAMIL NADU DELIVERY CONFIGURATION</p>
          <h1>Delivery Charge Settings</h1>
        </div>
      </div>
      <AdminFeedback error={error} notice={notice} />

      {loading ? (
        <p className="loading-copy">Loading delivery settings...</p>
      ) : (
        <form className="admin-form-card" onSubmit={save} style={{ maxWidth: 900 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center', marginBottom: 18 }}>
            <label className="admin-check" style={{ margin: 0 }}>
              <input
                type="checkbox"
                checked={enabled}
                onChange={(event) => setEnabled(event.target.checked)}
              />
              <strong>Enable Delivery Charges</strong>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
              <span>Fallback / Other State Delivery Charge: ₹</span>
              <input
                required
                type="number"
                min="0"
                step="0.01"
                value={defaultCharge}
                onChange={(e) => setDefaultCharge(e.target.value)}
                style={{ width: 100, minHeight: 36, padding: '4px 8px' }}
              />
            </label>
          </div>

          <div style={{ borderTop: '1px solid #dfcbc7', paddingTop: 18, marginTop: 14 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Tamil Nadu Districts ({districts.length} Districts)</h2>
                <p style={{ margin: '3px 0 0', color: '#806b6c', fontSize: '.75rem' }}>
                  Admin-configured delivery charge per district. Customers will automatically be charged this rate based on their delivery district.
                </p>
              </div>

              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Set All ₹"
                  value={flatRateInput}
                  onChange={(e) => setFlatRateInput(e.target.value)}
                  style={{ width: 110, minHeight: 36, padding: '4px 8px' }}
                />
                <button
                  type="button"
                  className="button button-outline"
                  onClick={applyFlatRate}
                  style={{ minHeight: 36, padding: '6px 12px', fontSize: '.7rem' }}
                >
                  Apply to All
                </button>
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <input
                type="text"
                placeholder="🔍 Search district (e.g. Chennai, Madurai, Coimbatore, Dindigul...)"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ maxWidth: 380, minHeight: 36 }}
              />
            </div>

            <div style={{ maxHeight: 440, overflowY: 'auto', border: '1px solid #dfcbc7', background: '#fff' }}>
              <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ position: 'sticky', top: 0, background: '#f5ece9', zIndex: 2 }}>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '9px 12px', width: 40 }}>#</th>
                    <th style={{ textAlign: 'left', padding: '9px 12px' }}>District</th>
                    <th style={{ textAlign: 'left', padding: '9px 12px', width: 180 }}>Delivery Charge (₹)</th>
                    <th style={{ textAlign: 'center', padding: '9px 12px', width: 70 }}>Active</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDistricts.map((d, index) => (
                    <tr key={d.id} style={{ borderBottom: '1px solid #f0e6e4' }}>
                      <td style={{ padding: '8px 12px', color: '#888' }}>{index + 1}</td>
                      <td style={{ padding: '8px 12px', fontWeight: 600 }}>{d.name}</td>
                      <td style={{ padding: '8px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>₹</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={d.charge}
                            onChange={(e) => updateDistrictCharge(d.id, e.target.value)}
                            style={{ width: 110, minHeight: 34, padding: '4px 8px' }}
                          />
                        </div>
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={d.is_active}
                          onChange={() => toggleDistrictActive(d.id)}
                          style={{ width: 18, height: 18, cursor: 'pointer' }}
                        />
                      </td>
                    </tr>
                  ))}
                  {filteredDistricts.length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', padding: 24, color: '#888' }}>
                        No districts match "{search}".
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ marginTop: 20 }}>
            <button className="button button-gold" disabled={busy} style={{ minWidth: 200 }}>
              {busy ? 'Saving settings...' : 'Save All Settings'}
            </button>
          </div>
        </form>
      )}
    </>
  );
}

export function AdminReportsPage() {
  const { data, error, loading } = useAdminData('/admin/reports/sales');
  const [dates, setDates] = useState({ from: '', to: '' });
  const [notice, setNotice] = useState('');
  const [report, setReport] = useState(null);
  const [requestError, setRequestError] = useState('');
  const [busy, setBusy] = useState('');
  const loadSales = async () => {
    setBusy('sales'); setRequestError(''); setNotice('');
    try { const { data: result } = await api.get('/admin/reports/sales', { params: dates }); setReport(result.report); }
    catch (e) { setRequestError(getErrorMessage(e)); }
    finally { setBusy(''); }
  };
  const download = async (path, filename) => {
    setBusy(filename); setRequestError(''); setNotice('');
    try {
      const { data: blob } = await api.get(path, { params: path.includes('/sales.pdf') ? dates : undefined, responseType: 'blob' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove(); URL.revokeObjectURL(url);
      setNotice(`${filename} downloaded.`);
    } catch (e) { setRequestError(getErrorMessage(e)); }
    finally { setBusy(''); }
  };
  if (loading || !data) return <><div className="admin-page-heading"><div><p className="eyebrow">A CLEAR LOOK AT THE BIG PICTURE</p><h1>Reports</h1></div></div><AdminFeedback error={error || requestError} notice={notice} /><p className="loading-copy">{loading ? 'Preparing reports...' : 'Sales report is unavailable.'}</p></>;
  return <><div className="admin-page-heading"><div><p className="eyebrow">A CLEAR LOOK AT THE BIG PICTURE</p><h1>Reports</h1></div></div><AdminFeedback error={error || requestError} notice={notice} /><div className="report-date-filter"><label>From<input type="date" value={dates.from} onChange={(e) => setDates({ ...dates, from: e.target.value })} /></label><label>To<input type="date" value={dates.to} onChange={(e) => setDates({ ...dates, to: e.target.value })} /></label><button className="button button-dark" onClick={loadSales} disabled={Boolean(busy)}>Update report</button></div>{loading ? <p className="loading-copy">Preparing reports...</p> : <div className="metric-grid report-metrics">{[['Sales', `₹${Number(report?.sales ?? data?.report.sales).toLocaleString('en-IN')}`, 'bi-currency-rupee'], ['Orders', report?.order_count ?? data?.report.order_count, 'bi-receipt'], ['Average order value', `₹${Number(report?.average_order_value ?? data?.report.average_order_value).toLocaleString('en-IN')}`, 'bi-graph-up']].map(([label, value, icon]) => <div className="metric-card" key={label}><span className="metric-icon"><i className={`bi ${icon}`} /></span><span>{label}</span><strong>{value}</strong></div>)}  </div>}<div className="admin-section-card"><div className="admin-card-heading"><div><p className="eyebrow">TAKE IT WITH YOU</p><h3>Download a report</h3></div></div><div className="download-grid"><button onClick={() => download('/admin/reports/orders.xlsx', 'vedhika-orders.xlsx')} disabled={Boolean(busy)}><i className="bi bi-file-earmark-spreadsheet" /><span><strong>Order details</strong><small>Excel workbook · all orders</small></span><i className="bi bi-download" /></button><button onClick={() => download('/admin/reports/orders.pdf', 'vedhika-orders.pdf')} disabled={Boolean(busy)}><i className="bi bi-file-earmark-pdf" /><span><strong>Order details</strong><small>PDF report · all orders</small></span><i className="bi bi-download" /></button><button onClick={() => download('/admin/reports/customers.xlsx', 'vedhika-customers.xlsx')} disabled={Boolean(busy)}><i className="bi bi-people" /><span><strong>Customer details</strong><small>Excel workbook · all customers</small></span><i className="bi bi-download" /></button><button onClick={() => download('/admin/reports/customers.pdf', 'vedhika-customers.pdf')} disabled={Boolean(busy)}><i className="bi bi-file-earmark-pdf" /><span><strong>Customer details</strong><small>PDF report · all customers</small></span><i className="bi bi-download" /></button><button onClick={() => download('/admin/reports/sales.pdf', 'vedhika-sales-report.pdf')} disabled={Boolean(busy)}><i className="bi bi-file-earmark-pdf" /><span><strong>Sales summary</strong><small>PDF report · selected dates</small></span><i className="bi bi-download" /></button></div></div></>;
}

export function AdminStorefrontSettingsPage() {
  const { data, error, loading, reload, setError } = useAdminData('/admin/storefront-settings');
  const [form, setForm] = useState({
    experience_eyebrow: 'THE BOUTIQUE EXPERIENCE',
    experience_title: 'vedhika Return Gift',
    experience_description: '',
    hero_image_url: '/boutique-hero-gifts.png',
    trending_title: 'Trending Now'
  });
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data?.settings) {
      setForm({
        experience_eyebrow: data.settings.experience_eyebrow || 'THE BOUTIQUE EXPERIENCE',
        experience_title: data.settings.experience_title || 'vedhika Return Gift',
        experience_description: data.settings.experience_description || '',
        hero_image_url: data.settings.hero_image_url || '/boutique-hero-gifts.png',
        trending_title: data.settings.trending_title || 'Trending Now',
      });
    }
  }, [data]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api.put('/admin/storefront-settings', form);
      setNotice('Storefront homepage settings saved successfully.');
      await reload();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const titleParts = (form.experience_title || 'vedhika Return Gift').trim().split(/\s+/);
  const mainPart = titleParts[0] || '';
  const accentPart = titleParts.slice(1).join(' ');

  return (
    <>
      <div className="admin-page-heading">
        <div>
          <p className="eyebrow">STOREFRONT BRANDING</p>
          <h1>Storefront Settings</h1>
        </div>
      </div>
      <AdminFeedback error={error} notice={notice} />

      <div className="storefront-settings-layout">
        <form className="admin-form-card" onSubmit={submit}>
          <div className="admin-card-heading">
            <h3>Homepage Banner & Headings</h3>
          </div>

          <div className="admin-product-form">
            <label className="admin-form-span">
              Boutique Experience Eyebrow
              <input
                required
                maxLength={120}
                value={form.experience_eyebrow}
                onChange={(e) => setForm({ ...form, experience_eyebrow: e.target.value })}
                placeholder="e.g. THE BOUTIQUE EXPERIENCE"
              />
              <span className="optional">The small uppercase subtitle preceded by a line.</span>
            </label>

            <label className="admin-form-span">
              Boutique Experience Title
              <input
                required
                maxLength={180}
                value={form.experience_title}
                onChange={(e) => setForm({ ...form, experience_title: e.target.value })}
                placeholder="e.g. vedhika Return Gift"
              />
              <span className="optional">The words after the first word will be rendered in elegant italic serif script.</span>
            </label>

            <label className="admin-form-span">
              Boutique Experience Description
              <textarea
                required
                maxLength={3000}
                rows={4}
                value={form.experience_description}
                onChange={(e) => setForm({ ...form, experience_description: e.target.value })}
                placeholder="Describe your boutique sanctuary..."
              />
            </label>

            <label className="admin-form-span">
              Hero Right-Side Return Gift Image URL
              <input
                maxLength={1000}
                value={form.hero_image_url}
                onChange={(e) => setForm({ ...form, hero_image_url: e.target.value })}
                placeholder="/boutique-hero-gifts.png or https://..."
              />
              <span className="optional">Leave as <code>/boutique-hero-gifts.png</code> for default curated return-gift photo, or paste any image URL.</span>
            </label>

            <label className="admin-form-span">
              Trending Section Heading
              <input
                required
                maxLength={120}
                value={form.trending_title}
                onChange={(e) => setForm({ ...form, trending_title: e.target.value })}
                placeholder="e.g. Trending Now"
              />
            </label>
          </div>

          <div style={{ marginTop: 24 }}>
            <button className="button button-gold" disabled={busy || loading}>
              {busy ? 'Saving changes...' : 'Save Settings'} <i className="bi bi-check-lg" />
            </button>
          </div>
        </form>

        <div className="admin-section-card storefront-preview-card">
          <div className="admin-card-heading">
            <h3>Live Preview</h3>
            <span className="optional">Live visual preview of homepage banner</span>
          </div>

          <div className="storefront-preview-box">
            <span className="boutique-eyebrow">{form.experience_eyebrow || 'THE BOUTIQUE EXPERIENCE'}</span>
            <div className="boutique-hero-title" style={{ fontSize: '2.5rem', marginBottom: 16 }}>
              <span className="brand-serif">{mainPart}</span>{' '}
              {accentPart && <span className="brand-script">{accentPart}</span>}
            </div>
            <p className="boutique-hero-description" style={{ fontSize: '0.88rem', marginBottom: 16 }}>
              {form.experience_description || 'Step into our sanctuary of thoughtful gifting and timeless South Indian craft...'}
            </p>
            <div className="boutique-hero-frame" style={{ maxWidth: 320 }}>
              <img
                src={!form.hero_image_url || form.hero_image_url === '/boutique-hero-gifts.png' ? defaultHeroGiftImg : form.hero_image_url}
                onError={(e) => {
                  if (e.currentTarget.src !== defaultHeroGiftImg) {
                    e.currentTarget.src = defaultHeroGiftImg;
                  }
                }}
                alt="Hero preview"
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

