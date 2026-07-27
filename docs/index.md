---
layout: home

hero:
  name: "Bromate Security & API Firewall"
  text: "Full security for WordPress and Headless WordPress sites."
  tagline: ""
  image:
    src: /bromate-routes.webp
    alt: Bromate Security API Firewall admin interface
  actions:
    - theme: brand
      text: Get Started
      link: /guide
    - theme: alt
      text: View on GitHub
      link: https://github.com/AfterglowWeb/wordpress-security-api-firewall

features:

  - icon: 🔒
    title: Full Security for Your WordPress Install
    details: ""
    link: /wordpress-security
    linkText: Learn more

  - icon: 🔒
    title: Full Security for the WordPress REST API
    details: ""
    link: /rest-api-security
    linkText: Learn more


---

<div class="vp-doc home-intro">

## Own your stack. Own your data.

</div>

<div class="vp-doc home-extra">

## How It Works

## Use Cases

<div class="use-cases-grid">

<div class="use-case-card">

### Headless CMS

</div>

<div class="use-case-card">

### Replace your SaaS CMS

</div>


</div>

---

## Free vs Pro

<div class="tier-comparison">

<div class="tier-card tier-free">

### Free Tier

</div>

<div class="tier-card tier-pro">

### Pro Tier

</div>

</div>

### Features

| Feature | Free | Pro |
|---|:---:|:---:|


---

## Screenshots

<div class="screenshots-grid">
  <figure>
    <img src="" alt="" />
    <figcaption></figcaption>
  </figure>
  <figure>
    <img src="" alt="" />
    <figcaption></figcaption>
  </figure>
  <figure>
    <img src="" alt="" />
    <figcaption></figcaption>
  </figure>
</div>

</div>

<style>
.VPHero .text {
  font-size: 2.5rem !important;
  line-height: 2.8rem !important;
}

.tier-comparison {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
  margin: 28px 0;
}

.tier-card {
  border: 2px solid var(--vp-c-divider);
  border-radius: 10px;
  padding: 16px 18px;
  position: relative;
}

.tier-card h3 {
  font-size: 1.05rem;
  margin: 0 0 12px 0;
  border: none;
  padding: 0;
  color: var(--vp-c-text-1);
  font-weight: 700;
}

.tier-free {
  background: linear-gradient(135deg, rgba(46, 125, 50, 0.05) 0%, rgba(76, 175, 80, 0.05) 100%);
  border-color: #4caf50;
}

.tier-free h3 {
  color: #2e7d32;
}

.tier-pro {
  background: linear-gradient(135deg, rgba(21, 101, 192, 0.05) 0%, rgba(33, 150, 243, 0.05) 100%);
  border-color: #1565c0;
  box-shadow: 0 4px 12px rgba(21, 101, 192, 0.15);
}

.tier-pro h3 {
  color: #1565c0;
}

.tier-card ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.tier-card li {
  padding: 5px 0;
  font-size: 13px;
  line-height: 1.45;
  color: var(--vp-c-text-2);
  border-bottom: 1px solid rgba(0, 0, 0, 0.04);
}

.tier-card li:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.tier-card strong {
  color: var(--vp-c-text-1);
  font-weight: 600;
}

.tier-card > p {
  font-size: 13px;
  line-height: 1.45;
  margin: 0 0 10px 0;
  color: var(--vp-c-text-2);
}

.home-intro {
  max-width: 1152px;
  margin: 0 auto;
  padding: 32px 24px;
}

.home-intro h2 {
  font-size: 1.75rem;
  font-weight: 700;
  margin: 0 0 16px;
}

.home-intro > p {
  font-size: 16px;
  color: var(--vp-c-text-2);
  max-width: 700px;
  line-height: 1.8;
  margin: 0;
}

.home-intro strong {
  color: var(--vp-c-text-1);
}

.home-extra {
  max-width: 1152px;
  margin: 0 auto;
  padding: 32px 24px 80px;
}

.home-extra h2 {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0 0 8px;
}

.home-extra > p {
  font-size: 15px;
  color: var(--vp-c-text-2);
  max-width: 700px;
  line-height: 1.75;
  margin: 0 0 48px;
}

.pillars-grid,
.use-cases-grid,
.roadmap-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;
  margin: 24px 0 56px;
}

.pillar-card,
.use-case-card,
.roadmap-card {
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  padding: 20px 24px;
}

.pillar-card h3,
.use-case-card h3 {
  font-size: 15px;
  font-weight: 600;
  margin: 0 0 8px;
  border: none;
  padding: 0;
}

.pillar-card p,
.use-case-card p {
  font-size: 14px;
  color: var(--vp-c-text-2);
  margin: 0;
  line-height: 1.65;
}

.roadmap-card {
  position: relative;
  font-size: 14px;
  line-height: 1.65;
  color: var(--vp-c-text-2);
}

.roadmap-card strong {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: var(--vp-c-text-1);
  margin: 6px 0 4px;
}

.roadmap-tag {
  display: inline-block;
  padding: 1px 7px;
  border-radius: 3px;
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.screenshots-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
  margin: 24px 0;
}

.screenshots-grid figure {
  margin: 0;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  overflow: hidden;
}

.screenshots-grid img {
  width: 100%;
  display: block;
}

.screenshots-grid figcaption {
  font-size: 12px;
  color: var(--vp-c-text-2);
  padding: 8px 12px;
  border-top: 1px solid var(--vp-c-divider);
  text-align: center;
}

.badge-pro {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 3px;
  background: #1565c0;
  color: #fff;
  font-size: 10px;
  font-weight: 600;
  vertical-align: middle;
  margin-left: 4px;
}

.VPHero .image img {
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
