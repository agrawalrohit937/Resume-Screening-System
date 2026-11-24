import { useEffect } from 'react';

/**
 * Reusable SEO, GEO & AEO Meta and Structured Data Component
 * Dynamically handles document.title, meta descriptions, Open Graph, Twitter cards, canonical tags, and JSON-LD schema
 */
export default function SEO({
  title,
  description,
  canonical,
  ogType = 'website',
  ogImage = 'https://www.careershala.tech/logo.png',
  schema,
}) {
  useEffect(() => {
    // 1. Update Title
    const originalTitle = document.title;
    if (title) {
      document.title = title.includes('CareerShala') ? title : `${title} | CareerShala`;
    }

    // Helper to safely set or create meta tag
    const setMetaTag = (attrName, attrValue, content) => {
      if (!content) return;
      let el = document.querySelector(`meta[${attrName}="${attrValue}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attrName, attrValue);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    // 2. Set Standard Meta Tags
    if (description) {
      setMetaTag('name', 'description', description);
      setMetaTag('property', 'og:description', description);
      setMetaTag('name', 'twitter:description', description);
    }

    // 3. Set OpenGraph & Twitter Title
    const currentTitle = document.title;
    setMetaTag('property', 'og:title', currentTitle);
    setMetaTag('name', 'twitter:title', currentTitle);

    // 4. Set OpenGraph Types and Images
    setMetaTag('property', 'og:type', ogType);
    if (ogImage) {
      setMetaTag('property', 'og:image', ogImage);
      setMetaTag('name', 'twitter:image', ogImage);
    }

    // 5. Set Canonical URL
    const pageUrl = canonical || window.location.href;
    setMetaTag('property', 'og:url', pageUrl);
    setMetaTag('name', 'twitter:url', pageUrl);

    let canonicalLink = document.querySelector('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute('href', pageUrl);

    // 6. Inject Route-Specific JSON-LD Schema (AEO / GEO)
    let schemaScript = null;
    if (schema) {
      schemaScript = document.getElementById('route-structured-data');
      if (!schemaScript) {
        schemaScript = document.createElement('script');
        schemaScript.id = 'route-structured-data';
        schemaScript.type = 'application/ld+json';
        document.head.appendChild(schemaScript);
      }
      schemaScript.textContent = JSON.stringify(schema);
    }

    return () => {
      // Cleanup route-specific JSON-LD schema on route transition
      const activeScript = document.getElementById('route-structured-data');
      if (activeScript) {
        activeScript.remove();
      }
    };
  }, [title, description, canonical, ogType, ogImage, schema]);

  return null;
}
