import {
  EQUIPMENT_KINDS,
  ORGANIZATION,
  SITE_DESCRIPTION,
  SITE_NAME,
  absolute,
  siteUrl,
} from './site';

/**
 * JSON-LD for the landing page.
 *
 * This is what an assistant reads when someone asks it where to borrow a
 * wheelchair for free — plain prose in a page body is guesswork for a machine,
 * a Service node with a zero-price offer and a catalogue is not. Only claims
 * the page actually makes are described here: no FAQPage, because Google
 * requires the questions to be visible on the page, and none are.
 */
export function landingPageJsonLd() {
  const org = `${siteUrl}/#organization`;
  const site = `${siteUrl}/#website`;

  const address =
    ORGANIZATION.streetAddress || ORGANIZATION.addressLocality
      ? {
          '@type': 'PostalAddress',
          streetAddress: ORGANIZATION.streetAddress || undefined,
          addressLocality: ORGANIZATION.addressLocality || undefined,
          addressRegion: ORGANIZATION.addressRegion || undefined,
          postalCode: ORGANIZATION.postalCode || undefined,
          addressCountry: 'TH',
        }
      : undefined;

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': ['NGO', 'MedicalOrganization'],
        '@id': org,
        name: SITE_NAME,
        url: siteUrl,
        description: SITE_DESCRIPTION,
        logo: {
          '@type': 'ImageObject',
          url: absolute('/assets/icon-512.png'),
          width: 512,
          height: 512,
        },
        image: absolute('/assets/og-image.png'),
        knowsLanguage: 'th',
        areaServed: ORGANIZATION.areaServed,
        ...(ORGANIZATION.telephone ? { telephone: ORGANIZATION.telephone } : {}),
        ...(address ? { address } : {}),
      },
      {
        '@type': 'WebSite',
        '@id': site,
        url: siteUrl,
        name: SITE_NAME,
        description: SITE_DESCRIPTION,
        inLanguage: 'th-TH',
        publisher: { '@id': org },
      },
      {
        '@type': 'WebPage',
        '@id': `${siteUrl}/#webpage`,
        url: siteUrl,
        name: SITE_NAME,
        description: SITE_DESCRIPTION,
        inLanguage: 'th-TH',
        isPartOf: { '@id': site },
        about: { '@id': org },
        primaryImageOfPage: absolute('/assets/og-image.png'),
      },
      {
        '@type': 'Service',
        '@id': `${siteUrl}/#service`,
        name: 'บริการยืม-คืนกายอุปกรณ์การแพทย์ ไม่มีค่าใช้จ่าย',
        serviceType: 'การให้ยืมกายอุปกรณ์การแพทย์',
        description:
          'ให้ยืมกายอุปกรณ์การแพทย์สำหรับผู้ป่วยและผู้ดูแลที่บ้าน โดยไม่มีค่าใช้จ่าย ' +
          'ส่งคำขอออนไลน์ได้โดยไม่ต้องสมัครสมาชิก เจ้าหน้าที่ตรวจสอบคำขอและติดต่อกลับ ' +
          'เพื่อนัดหมายรับอุปกรณ์',
        provider: { '@id': org },
        areaServed: ORGANIZATION.areaServed,
        availableLanguage: 'th',
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'THB',
          availability: 'https://schema.org/InStock',
          url: absolute('/request'),
        },
        availableChannel: {
          '@type': 'ServiceChannel',
          serviceUrl: absolute('/request'),
          name: 'แบบฟอร์มขอยืมออนไลน์',
          availableLanguage: 'th',
        },
        hasOfferCatalog: {
          '@type': 'OfferCatalog',
          name: 'กายอุปกรณ์ที่ให้ยืม',
          itemListElement: EQUIPMENT_KINDS.map((name) => ({
            '@type': 'Offer',
            price: '0',
            priceCurrency: 'THB',
            itemOffered: { '@type': 'Product', name, category: 'กายอุปกรณ์การแพทย์' },
          })),
        },
      },
    ],
  };
}
