import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { getErrorMessage } from '../services/api';
import ProductCard from '../components/ProductCard';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const defaultBoutiqueSettings = {
  experience_eyebrow: 'THE BOUTIQUE EXPERIENCE',
  experience_title: 'vedhika Boutique',
  experience_description:
    'Step into our sanctuary of timeless Indian fashion. From opulent Kanchipuram mulberry silks and hand-embroidered bridal couture to contemporary festive kurtis, every piece at Vedhika Boutique is handpicked to celebrate your grace.',
  trending_title: 'Trending Now',
};

const experienceSteps = [
  ['bi-chat-heart', 'CONSULTATION', 'Discuss your event theme, guest list, and vision with our dedicated gifting concierge.'],
  ['bi-stars', 'CUSTOMIZATION', 'Select products, bespoke packaging, ribbons and personalized name tags or logos.'],
  ['bi-flower1', 'CURATION', 'Our artisans carefully prepare and arrange every gift.'],
  ['bi-box-seam', 'DELIVERY', 'Relax as we handle the logistics, ensuring pristine, on-time delivery to your venue.'],
];

export default function HomePage() {
  const [products, setProducts] = useState([]);
  const [trendingProducts, setTrendingProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [settings, setSettings] = useState(defaultBoutiqueSettings);
  const [error, setError] = useState('');
  const { addItem } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const sliderRef = useRef(null);

  useEffect(() => {
    Promise.allSettled([
      api.get('/storefront-settings'),
      api.get('/products?trending=true'),
      api.get('/categories'),
      api.get('/products?limit=6&sort=newest'),
    ]).then(([settingsRes, trendingRes, catRes, prodRes]) => {
      if (settingsRes.status === 'fulfilled' && settingsRes.value?.data?.settings) {
        setSettings(settingsRes.value.data.settings);
      }
      if (trendingRes.status === 'fulfilled' && trendingRes.value?.data?.products) {
        setTrendingProducts(trendingRes.value.data.products);
      }
      if (catRes.status === 'fulfilled' && catRes.value?.data?.categories) {
        setCategories(catRes.value.data.categories);
      }
      if (prodRes.status === 'fulfilled' && prodRes.value?.data?.products) {
        setProducts(prodRes.value.data.products);
      }
    });
  }, []);

  const add = async (product) => {
    if (!user) { navigate('/login'); return; }
    try { await addItem(product.id); } catch (requestError) { setError(getErrorMessage(requestError)); }
  };

  const buy = async (product) => {
    if (!user) { navigate('/login'); return; }
    try { await addItem(product.id); navigate('/checkout'); }
    catch (requestError) { setError(getErrorMessage(requestError)); }
  };

  const scrollTrending = (direction) => {
    if (sliderRef.current) {
      const scrollAmount = direction === 'left' ? -340 : 340;
      sliderRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  // Title formatting: split "vedhika Boutique" into serif & italic script
  const titleText = settings.experience_title || 'vedhika Boutique';
  const parts = titleText.trim().split(' ');
  const mainPart = parts.length > 1 ? parts.slice(0, -1).join(' ') : parts[0];
  const accentPart = parts.length > 1 ? parts[parts.length - 1] : '';

  // Order categories prioritizing the ones shown in image
  const prioritySlugs = [
    'sarees',
    'suits-kurtis',
    'ethnic-wear',
    'lehengas',
    'jewellery',
    'return-gifts',
    'accessories',
    'home-accessories',
  ];

  const sortedCategories = [...categories].sort((a, b) => {
    const idxA = prioritySlugs.indexOf(a.slug);
    const idxB = prioritySlugs.indexOf(b.slug);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <>
      {/* 1. THE BOUTIQUE EXPERIENCE HERO (Replaces Curated Elegance) */}
      <section className="boutique-experience-hero">
        <div className="boutique-hero-inner">
          <span className="boutique-eyebrow">
            {settings.experience_eyebrow || 'THE BOUTIQUE EXPERIENCE'}
          </span>
          <h1 className="boutique-hero-title">
            <span className="brand-serif">{mainPart}</span>
            {accentPart && <span className="brand-script">{accentPart}</span>}
          </h1>
          <p className="boutique-hero-description">
            {settings.experience_description}
          </p>
        </div>
      </section>

      {/* 2. TRENDING NOW SECTION */}
      <section className="trending-now-section">
        <div className="trending-header">
          <div className="trending-title-wrap">
            <h2 className="trending-title">{settings.trending_title || 'Trending Now'}</h2>
            <div className="trending-title-underline" />
          </div>
          <Link to="/return-gifts" className="trending-view-all">
            VIEW ALL COLLECTION <i className="bi bi-chevron-right" />
          </Link>
        </div>

        {trendingProducts.length === 0 ? (
          <div className="trending-empty-container">
            <p className="trending-empty-text">
              No trending items currently selected. Select "Make as Trending" in the Admin Panel to feature items here.
            </p>
            <button className="trending-arrow-btn" aria-label="Next">
              <i className="bi bi-chevron-right" />
            </button>
          </div>
        ) : (
          <div className="trending-slider-wrapper">
            {trendingProducts.length > 3 && (
              <button
                className="trending-arrow-btn slider-prev"
                onClick={() => scrollTrending('left')}
                aria-label="Previous"
              >
                <i className="bi bi-chevron-left" />
              </button>
            )}
            <div className="trending-products-slider" ref={sliderRef}>
              {trendingProducts.map((product) => (
                <div className="trending-product-item" key={product.id}>
                  <ProductCard product={product} onAdd={add} onBuy={buy} />
                </div>
              ))}
            </div>
            {trendingProducts.length > 3 && (
              <button
                className="trending-arrow-btn slider-next"
                onClick={() => scrollTrending('right')}
                aria-label="Next"
              >
                <i className="bi bi-chevron-right" />
              </button>
            )}
          </div>
        )}
      </section>

      {/* 3. SHOP BY CATEGORY SECTION */}
      <section className="shop-by-category-section">
        <div className="category-section-header">
          <h2 className="category-section-title">Shop by Category</h2>
          <div className="category-section-underline" />
        </div>
        <div className="category-circle-row">
          {sortedCategories.map((category) => (
            <Link
              key={category.id}
              to={`/return-gifts?category=${category.slug}`}
              className="category-circle-card"
            >
              <div className="category-circle-thumb">
                {category.image_url ? (
                  <img src={category.image_url} alt={category.name} loading="lazy" />
                ) : (
                  <span className="category-circle-fallback">
                    {category.name.charAt(0)}
                  </span>
                )}
              </div>
              <span className="category-circle-label">{category.name}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* 4. FEATURED PRODUCTS COLLECTION */}
      <section className="section featured-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">VEDHIKA BRAND · RETURN GIFTS</p>
            <h2>Considered gifts. <em>Lasting impressions.</em></h2>
          </div>
          <Link to="/return-gifts" className="text-link">VIEW RETURN GIFTS <span>→</span></Link>
        </div>
        {error && <div className="alert alert-danger">{error}</div>}
        {products.length ? (
          <div className="product-grid">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} onAdd={add} onBuy={buy} />
            ))}
          </div>
        ) : (
          <div className="empty-collection">
            <span>V</span>
            <h3>The VEDHIKA collection is being curated.</h3>
            <p>Visit again soon or tell us what you’re celebrating.</p>
            <Link to="/quote" className="button button-gold">REQUEST A QUOTE</Link>
          </div>
        )}
      </section>

      {/* 5. THE VEDHIKA EXPERIENCE */}
      <section className="section experience-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">THE VEDHIKA EXPERIENCE</p>
            <h2>Thoughtfully curated, <em>beautifully delivered.</em></h2>
          </div>
        </div>
        <div className="experience-grid">
          {experienceSteps.map(([icon, title, copy], index) => (
            <article className="experience-step" key={title}>
              <span className="experience-icon"><i className={`bi ${icon}`} /></span>
              <span className="experience-number">0{index + 1}</span>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
