# Getting Started

## Installation

### 1. Clone the repository

```bash
cd wp-content/plugins/
git clone https://github.com/AfterglowWeb/wordpress-security-api-firewall.git security-api-firewall
cd security-api-firewall
```

### 2. Install PHP dependencies

```bash
composer install
```

### 3. Install JS dependencies and build

```bash
yarn
yarn build
```

### 4. Activate the plugin

Go to **WordPress Admin → Plugins** and activate **WordPress Application Layer**.

## Start Here: First-Run Checklist

After activation, use this order in the admin UI:

1. Open **Auth & Rate Limiting** and link at least one WordPress user.
2. Open **Routes** and enable authentication/rate limiting defaults for your API surface.
3. Open **IP Filtering** and define your baseline global blocklist rules.
4. Open **Properties** and apply global transforms (relative URLs, embedded fields, flattening).
5. Open **Webhook** if you need outbound event delivery.

## Go Pro: First-Run Checklist

1. Activate your license in **License Management**.
2. Create your first **Application**.
3. Configure application defaults in **Settings** and module cards.
4. Link users in **Users** and refine route access in **Routes**.
5. If running headless only, configure **WordPress Mode**.

## Keep It Safe: Architecture Checks (Recommended)

Run these before major refactors:

```bash
yarn graph:lint
composer graph:php
```