import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api, { getErrorMessage, resolveMediaUrl } from '../services/api';
import ProductCard from '../components/ProductCard';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import defaultHeroGiftImg from '../assets/boutique-hero-gifts.png';

const defaultBoutiqueSettings = {
  experience_eyebrow: 'THE BOUTIQUE EXPERIENCE',
  experience_title: 'vedhika Return Gift',
  experience_description:
    'Step into our sanctuary of thoughtful gifting and timeless South Indian craft. From brass diyas, silk potli keepsakes, and personalized favours to bespoke festive hampers, every return gift at Vedhika is curated to celebrate your guests with grace.',
  hero_image_url: '',
  trending_title: 'Trending Now',
};

export default function HomePage() {
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
    ]).then(([settingsRes, trendingRes, catRes]) => {
      if (settingsRes.status === 'fulfilled' && settingsRes.value?.data?.settings) {
        setSettings(settingsRes.value.data.settings);
      }
      if (trendingRes.status === 'fulfilled' && trendingRes.value?.data?.products) {
        setTrendingProducts(trendingRes.value.data.products);
      }
      if (catRes.status === 'fulfilled' && catRes.value?.data?.categories) {
        setCategories(catRes.value.data.categories);
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

  // Title formatting: split first word ("vedhika") into serif & remaining words ("Return Gift") into italic script
  const titleText = settings.experience_title || 'vedhika Return Gift';
  const parts = titleText.trim().split(/\s+/);
  const mainPart = parts[0] || '';
  const accentPart = parts.slice(1).join(' ');

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

  const trendingCategories = sortedCategories.filter((category) => category.is_trending);
  const totalTrendingCount = trendingCategories.length + trendingProducts.length;

  const heroImgSrc =
    !settings.hero_image_url || settings.hero_image_url === '/boutique-hero-gifts.png'
      ? defaultHeroGiftImg
      : settings.hero_image_url;

  return (
    <>
      {/* 1. THE BOUTIQUE EXPERIENCE HERO */}
      <section className="boutique-experience-hero">
        <div className="boutique-hero-grid">
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
          <div className="boutique-hero-visual">
            <div className="boutique-hero-frame">
              <img
                src={heroImgSrc}
                onError={(e) => {
                  if (e.currentTarget.src !== defaultHeroGiftImg) {
                    e.currentTarget.src = defaultHeroGiftImg;
                  }
                }}
                alt="Curated Luxury Return Gifts by Vedhika Boutique"
              />
            </div>
          </div>
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

        {error && <div className="alert alert-danger">{error}</div>}

        {totalTrendingCount === 0 ? (
          <div className="trending-empty-container">
            <p className="trending-empty-text">
              No trending items currently selected. Select "Trending Now" in the Admin Panel to feature items here.
            </p>
            <button className="trending-arrow-btn" aria-label="Next">
              <i className="bi bi-chevron-right" />
            </button>
          </div>
        ) : (
          <div className="trending-slider-wrapper">
            {totalTrendingCount > 3 && (
              <button
                className="trending-arrow-btn slider-prev"
                onClick={() => scrollTrending('left')}
                aria-label="Previous"
              >
                <i className="bi bi-chevron-left" />
              </button>
            )}
            <div className="trending-products-slider" ref={sliderRef}>
              {trendingCategories.map((category) => (
                <div className="trending-product-item" key={`cat-${category.id}`}>
                  <Link
                    to={`/return-gifts?category=${category.slug}`}
                    className="trending-category-card"
                  >
                    <div className="trending-category-media">
                      {category.image_url ? (
                        <img src={resolveMediaUrl(category.image_url)} alt={category.name} loading="lazy" />
                      ) : (
                        <div className="product-image-placeholder">
                          <span>{category.name.charAt(0)}</span>
                        </div>
                      )}
                      <span className="product-tag">TRENDING NOW</span>
                    </div>
                    <div className="trending-category-body">
                      <span className="eyebrow">COLLECTION</span>
                      <h3>{category.name}</h3>
                      {category.description && <p>{category.description}</p>}
                      <span className="trending-category-cta">
                        EXPLORE COLLECTION <i className="bi bi-arrow-right" />
                      </span>
                    </div>
                  </Link>
                </div>
              ))}
              {trendingProducts.map((product) => (
                <div className="trending-product-item" key={`prod-${product.id}`}>
                  <ProductCard product={product} onAdd={add} onBuy={buy} />
                </div>
              ))}
            </div>
            {totalTrendingCount > 3 && (
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
                  <img src={resolveMediaUrl(category.image_url)} alt={category.name} loading="lazy" />
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
    </>
  );
}
