import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api, { getErrorMessage } from '../services/api';
import ProductCard from '../components/ProductCard';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

const returnGiftSlugs = new Set([
  'wedding-return-gifts',
  'birthday-return-gifts',
  'baby-shower-return-gifts',
  'housewarming-return-gifts',
  'traditional-return-gifts',
  'customized-return-gifts',
]);

const isReturnGiftSlug = (slug) => {
  if (!slug) return false;
  return returnGiftSlugs.has(slug) || slug.includes('return-gift') || slug.includes('return');
};

export default function ReturnGiftsPage() {
  const [params] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { user } = useAuth();
  const { addItem } = useCart();
  const navigate = useNavigate();
  const selectedSlug = params.get('category') || '';

  useEffect(() => {
    let active = true;
    setLoading(true);
    const productRequest = selectedSlug
      ? api.get('/products', { params: { category: selectedSlug, limit: 100 } })
      : api.get('/products?limit=100');

    Promise.all([productRequest, api.get('/categories')])
      .then(([productResponse, categoryResponse]) => {
        if (!active) return;
        const allProducts = productResponse.data.products || [];
        const allCategories = categoryResponse.data.categories || [];
        setProducts(selectedSlug ? allProducts : allProducts.filter((product) => isReturnGiftSlug(product.category_slug)));
        setCategories(allCategories);
        setError('');
      })
      .catch((requestError) => {
        if (active) setError(getErrorMessage(requestError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [selectedSlug]);

  const add = async (product) => {
    if (!user) { navigate('/login'); return; }
    try { await addItem(product.id); }
    catch (requestError) { setError(getErrorMessage(requestError)); }
  };

  const buy = async (product) => {
    if (!user) { navigate('/login'); return; }
    try { await addItem(product.id); navigate('/checkout'); }
    catch (requestError) { setError(getErrorMessage(requestError)); }
  };

  const selected = categories.find((category) => category.slug === selectedSlug);
  const returnGiftCategories = categories.filter((category) => isReturnGiftSlug(category.slug));

  return (
    <section className="return-gifts-page">
      <div className="section return-gifts-collection">
        <div className="section-heading">
          <div>
            <p className="eyebrow">THE RETURN GIFT COLLECTION</p>
            <h2>{selected?.name || 'Give thanks, beautifully.'}</h2>
          </div>
          <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
            {selectedSlug && (
              <Link className="text-link" to="/return-gifts">← ALL COLLECTIONS</Link>
            )}
            <Link className="text-link" to="/quote">BULK &amp; BESPOKE ORDERS →</Link>
          </div>
        </div>

        {!selectedSlug && (
          <nav className="return-category-list" aria-label="Return gift categories">
            <Link className="active" to="/return-gifts">All occasions</Link>
            {returnGiftCategories.map((category) => (
              <Link key={category.id} to={`/return-gifts?category=${category.slug}`}>
                {category.name}
              </Link>
            ))}
          </nav>
        )}

        {error && <div className="alert alert-danger">{error}</div>}

        {loading ? (
          <p className="loading-copy">Loading collection...</p>
        ) : products.length ? (
          <div className="product-grid">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} onAdd={add} onBuy={buy} showDetailsButton />
            ))}
          </div>
        ) : !error && (
          <div className="empty-collection">
            <span>V</span>
            <h3>{selected ? `${selected.name} is ready to be curated.` : 'Our return gift collection is growing.'}</h3>
            <p>Tell VEDHIKA BRAND about your celebration and we’ll help create something meaningful.</p>
            <Link to="/quote" className="button button-gold">REQUEST A BESPOKE QUOTE</Link>
          </div>
        )}
      </div>
    </section>
  );
}
