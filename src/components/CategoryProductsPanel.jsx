import { useRef, useState } from 'react';
import api, { getErrorMessage, resolveMediaUrl } from '../services/api';
import { useAdminFeedback } from './AdminDialogs';

const emptyCategoryProduct = {
  name: '',
  description: '',
  price: '',
  offerPercentage: '0',
  stock: '10',
  isCustomizable: false,
  isTrending: false,
  isActive: true,
};

/** Inline manager to view, add, edit, trend, and remove unlimited products inside a specific category. */
export default function CategoryProductsPanel({ category, products, onClose, onChanged }) {
  const { notify, confirmDelete } = useAdminFeedback();
  const [form, setForm] = useState(emptyCategoryProduct);
  const [editingProductId, setEditingProductId] = useState(null);
  const [files, setFiles] = useState([]);
  const [existingImages, setExistingImages] = useState([]);
  const [deletingImageId, setDeletingImageId] = useState(null);
  const [togglingId, setTogglingId] = useState(null);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef(null);

  const resetForm = () => {
    setForm(emptyCategoryProduct);
    setEditingProductId(null);
    setFiles([]);
    setExistingImages([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const startEdit = (product) => {
    setEditingProductId(product.id);
    setForm({
      name: product.name || '',
      description: product.description || '',
      price: product.price ?? '',
      offerPercentage: String(product.offer_percentage ?? 0),
      stock: String(product.stock ?? 0),
      isCustomizable: Boolean(product.is_customizable),
      isTrending: Boolean(product.is_trending),
      isActive: product.is_active !== false,
    });
    setFiles([]);
    setExistingImages(product.images || []);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      const savedName = form.name.trim();
      const payload = {
        name: savedName,
        categoryId: category.id,
        description: form.description.trim(),
        price: Number(form.price),
        offerPercentage: Number(form.offerPercentage || 0),
        stock: Number(form.stock || 0),
        isCustomizable: Boolean(form.isCustomizable),
        isTrending: Boolean(form.isTrending),
        isActive: editingProductId ? Boolean(form.isActive) : true,
      };
      const response = editingProductId
        ? await api.patch(`/admin/products/${editingProductId}`, payload)
        : await api.post('/admin/products', payload);
      const product = response.data.product;
      if (files.length) {
        const upload = new FormData();
        Array.from(files).slice(0, 5).forEach((file) => upload.append('images', file));
        await api.post(`/admin/products/${product.id}/images`, upload);
      }
      notify.success(
        editingProductId
          ? `"${savedName}" updated inside "${category.name}".`
          : `"${savedName}" added to "${category.name}". You can add another right away!`,
        editingProductId ? 'Updated' : 'Product Added'
      );
      resetForm();
      await onChanged();
    } catch (e) {
      notify.error(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const toggleTrending = async (product) => {
    setTogglingId(product.id);
    try {
      await api.post(`/admin/products/${product.id}/trending`);
      notify.success(`"${product.name}" trending status updated.`);
      await onChanged();
    } catch (e) {
      notify.error(getErrorMessage(e));
    } finally {
      setTogglingId(null);
    }
  };

  const removeImage = (image) => {
    if (!editingProductId) return;
    confirmDelete({
      title: 'Delete product image?',
      message: 'Delete this product image? This cannot be undone.',
      confirmLabel: 'Delete image',
      onConfirm: async () => {
        setDeletingImageId(image.id);
        try {
          const { data: response } = await api.delete(`/admin/products/${editingProductId}/images/${image.id}`);
          setExistingImages(response.images);
          if (response.warning) notify.error(response.warning);
          else notify.deleted('Product image deleted.');
          await onChanged();
        } catch (e) {
          notify.error(getErrorMessage(e));
        } finally {
          setDeletingImageId(null);
        }
      },
    });
  };

  const removeProduct = (product) => {
    confirmDelete({
      title: 'Remove product?',
      message: `Remove "${product.name}" from "${category.name}" and the storefront?`,
      confirmLabel: 'Remove product',
      onConfirm: async () => {
        try {
          await api.delete(`/admin/products/${product.id}`);
          if (editingProductId === product.id) resetForm();
          notify.deleted(`"${product.name}" removed from "${category.name}".`);
          await onChanged();
        } catch (e) {
          notify.error(getErrorMessage(e));
        }
      },
    });
  };

  return (
    <div className="category-products-panel">
      <div className="category-products-panel-head">
        <div>
          <span className="eyebrow">CATEGORY PRODUCTS</span>
          <h4>{category.name} · {products.length} {products.length === 1 ? 'product' : 'products'}</h4>
        </div>
        <button type="button" className="text-button" onClick={onClose}>
          Close <i className="bi bi-x-lg" />
        </button>
      </div>

      <form className="category-products-form" onSubmit={handleSubmit}>
        <div className="category-products-form-head">
          <strong>
            {editingProductId ? `Edit product in "${category.name}"` : `+ Add product to "${category.name}"`}
          </strong>
          {editingProductId && (
            <button type="button" className="text-button" onClick={resetForm}>Cancel edit</button>
          )}
        </div>

        <div className="category-products-form-grid">
          <label>
            Product name
            <input
              required
              minLength="2"
              maxLength="180"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Brass Diya Return Gift"
            />
          </label>
          <label>
            Price (₹)
            <input
              required
              type="number"
              min="0"
              step="0.01"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              placeholder="e.g. 299"
            />
          </label>
          <label>
            Offer (%)
            <input
              type="number"
              min="0"
              max="100"
              step="1"
              value={form.offerPercentage}
              onChange={(e) => setForm({ ...form, offerPercentage: e.target.value })}
              placeholder="0"
            />
          </label>
          <label>
            Available stock
            <input
              required
              type="number"
              min="0"
              step="1"
              value={form.stock}
              onChange={(e) => setForm({ ...form, stock: e.target.value })}
              placeholder="10"
            />
          </label>
          <label className="admin-form-span">
            Description
            <textarea
              required
              minLength="3"
              maxLength="5000"
              rows="2"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Describe the return gift..."
            />
          </label>

          {editingProductId && existingImages.length > 0 && (
            <div className="admin-form-span">
              <span className="admin-image-label">Current product images</span>
              <div className="admin-image-list">
                {existingImages.map((image) => (
                  <div className="admin-image-item" key={image.id}>
                    <img src={resolveMediaUrl(image.url)} alt={image.alt_text || form.name} />
                    <button
                      type="button"
                      className="danger-link"
                      disabled={deletingImageId === image.id}
                      onClick={() => removeImage(image)}
                    >
                      {deletingImageId === image.id ? 'Deleting…' : 'Delete image'} <i className="bi bi-trash" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <label className="admin-form-span">
            Product images <span className="optional">(up to 5, max 5 MB each)</span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              onChange={(e) => setFiles(e.target.files)}
            />
          </label>
        </div>

        <div className="category-products-form-footer">
          <div className="category-products-checks">
            <label className="admin-check">
              <input
                type="checkbox"
                checked={form.isCustomizable}
                onChange={(e) => setForm({ ...form, isCustomizable: e.target.checked })}
              />
              Printed names / gift message
            </label>
            <label className="admin-check">
              <input
                type="checkbox"
                checked={form.isTrending}
                onChange={(e) => setForm({ ...form, isTrending: e.target.checked })}
              />
              Make as Trending
            </label>
          </div>
          <button className="button button-dark" disabled={busy}>
            {busy ? 'Saving…' : editingProductId ? 'Save product' : `Add product to ${category.name}`} <i className="bi bi-plus-lg" />
          </button>
        </div>
      </form>

      <div className="category-products-list-wrap">
        {products.length ? (
          <div className="category-product-items">
            {products.map((product) => (
              <div className="category-product-item" key={product.id}>
                <div className="category-product-thumb">
                  {product.image_url ? (
                    <img src={resolveMediaUrl(product.image_url)} alt={product.name} />
                  ) : (
                    <span>{product.name.charAt(0)}</span>
                  )}
                </div>
                <div className="category-product-meta">
                  <strong>{product.name}</strong>
                  <div className="category-product-pricing">
                    <span>₹{Number(product.final_price ?? product.price).toLocaleString('en-IN')}</span>
                    {product.offer_percentage > 0 && (
                      <>
                        <del>₹{Number(product.price).toLocaleString('en-IN')}</del>
                        <em>{product.offer_percentage}% OFF</em>
                      </>
                    )}
                    <small>· {product.stock} in stock</small>
                    {product.is_customizable && <small>· Personalizable</small>}
                  </div>
                </div>
                <div className="category-product-actions">
                  <button
                    type="button"
                    className={`admin-trending-badge ${product.is_trending ? 'active' : ''}`}
                    disabled={togglingId === product.id}
                    onClick={() => toggleTrending(product)}
                  >
                    {product.is_trending ? '★ Trending' : '☆ Trending'}
                  </button>
                  <button type="button" className="text-button" onClick={() => startEdit(product)}>Edit</button>
                  <button type="button" className="text-button danger-link" onClick={() => removeProduct(product)}>Remove</button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="category-products-empty">No products in "{category.name}" yet. Add your first product above — you can add as many as you want.</p>
        )}
      </div>
    </div>
  );
}
