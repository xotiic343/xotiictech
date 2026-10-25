-- XotiicTech schema for Supabase (generated from the Alembic migrations, revision 0003).
-- Run ONCE in Supabase -> SQL Editor on an EMPTY database.
-- Optional: the API also creates these tables itself on startup (alembic upgrade head).
-- If the tables already exist, don't run this; it will error on the first CREATE TABLE.
BEGIN;

CREATE TABLE alembic_version (
    version_num VARCHAR(32) NOT NULL, 
    CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
);

-- Running upgrade  -> 0001

CREATE TABLE audit_logs (
    id SERIAL NOT NULL, 
    actor VARCHAR(120) NOT NULL, 
    action VARCHAR(80) NOT NULL, 
    entity_type VARCHAR(60), 
    entity_id VARCHAR(64), 
    details JSON, 
    ip VARCHAR(64), 
    created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    CONSTRAINT pk_audit_logs PRIMARY KEY (id)
);

CREATE INDEX ix_audit_logs_action ON audit_logs (action);

CREATE INDEX ix_audit_logs_created_at ON audit_logs (created_at);

CREATE TABLE blog_posts (
    id SERIAL NOT NULL, 
    slug VARCHAR(160) NOT NULL, 
    title VARCHAR(200) NOT NULL, 
    excerpt VARCHAR(400) NOT NULL, 
    body TEXT NOT NULL, 
    kind VARCHAR(20) NOT NULL, 
    tags JSON NOT NULL, 
    cover_image VARCHAR(500), 
    is_published BOOLEAN NOT NULL, 
    published_at TIMESTAMP WITH TIME ZONE, 
    created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    CONSTRAINT pk_blog_posts PRIMARY KEY (id)
);

CREATE INDEX ix_blog_posts_is_published ON blog_posts (is_published);

CREATE UNIQUE INDEX ix_blog_posts_slug ON blog_posts (slug);

CREATE TABLE bot_sync_logs (
    id SERIAL NOT NULL, 
    trigger VARCHAR(16) NOT NULL, 
    status VARCHAR(16) NOT NULL, 
    started_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    finished_at TIMESTAMP WITH TIME ZONE, 
    bots_seen INTEGER NOT NULL, 
    bots_new INTEGER NOT NULL, 
    bots_failed INTEGER NOT NULL, 
    errors JSON NOT NULL, 
    CONSTRAINT pk_bot_sync_logs PRIMARY KEY (id)
);

CREATE INDEX ix_bot_sync_logs_started_at ON bot_sync_logs (started_at);

CREATE TABLE bots (
    id SERIAL NOT NULL, 
    discord_id VARCHAR(32) NOT NULL, 
    application_id VARCHAR(32), 
    username VARCHAR(100) NOT NULL, 
    avatar_hash VARCHAR(64), 
    banner_hash VARCHAR(64), 
    app_description TEXT, 
    app_tags JSON NOT NULL, 
    bot_public BOOLEAN NOT NULL, 
    guild_count INTEGER NOT NULL, 
    install_scopes JSON NOT NULL, 
    install_permissions VARCHAR(32), 
    custom_install_url VARCHAR(500), 
    status VARCHAR(16) NOT NULL, 
    last_synced_at TIMESTAMP WITH TIME ZONE, 
    last_error TEXT, 
    first_seen_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    slug VARCHAR(120) NOT NULL, 
    display_name VARCHAR(100), 
    short_description VARCHAR(300), 
    long_description TEXT, 
    tags JSON, 
    category VARCHAR(60), 
    pricing_type VARCHAR(16) NOT NULL, 
    price_label VARCHAR(60), 
    media JSON NOT NULL, 
    support_url VARCHAR(500), 
    website_url VARCHAR(500), 
    invite_permissions VARCHAR(32), 
    version VARCHAR(40), 
    changelog TEXT, 
    is_featured BOOLEAN NOT NULL, 
    is_hidden BOOLEAN NOT NULL, 
    is_published BOOLEAN NOT NULL, 
    published_at TIMESTAMP WITH TIME ZONE, 
    sort_order INTEGER NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    CONSTRAINT pk_bots PRIMARY KEY (id)
);

CREATE UNIQUE INDEX ix_bots_discord_id ON bots (discord_id);

CREATE INDEX ix_bots_is_published ON bots (is_published);

CREATE UNIQUE INDEX ix_bots_slug ON bots (slug);

CREATE TABLE contact_messages (
    id SERIAL NOT NULL, 
    name VARCHAR(120) NOT NULL, 
    email VARCHAR(320) NOT NULL, 
    subject VARCHAR(200) NOT NULL, 
    message TEXT NOT NULL, 
    status VARCHAR(16) NOT NULL, 
    ip VARCHAR(64), 
    created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    CONSTRAINT pk_contact_messages PRIMARY KEY (id)
);

CREATE INDEX ix_contact_messages_created_at ON contact_messages (created_at);

CREATE TABLE discord_tokens (
    id SERIAL NOT NULL, 
    fingerprint VARCHAR(64) NOT NULL, 
    masked_hint VARCHAR(32) NOT NULL, 
    env_position INTEGER, 
    bot_discord_id VARCHAR(32), 
    bot_username VARCHAR(100), 
    status VARCHAR(16) NOT NULL, 
    last_checked_at TIMESTAMP WITH TIME ZONE, 
    last_error TEXT, 
    created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    CONSTRAINT pk_discord_tokens PRIMARY KEY (id), 
    CONSTRAINT uq_discord_tokens_fingerprint UNIQUE (fingerprint)
);

CREATE TABLE newsletter_subscribers (
    id SERIAL NOT NULL, 
    email VARCHAR(320) NOT NULL, 
    source VARCHAR(60), 
    created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    unsubscribed_at TIMESTAMP WITH TIME ZONE, 
    CONSTRAINT pk_newsletter_subscribers PRIMARY KEY (id), 
    CONSTRAINT uq_newsletter_subscribers_email UNIQUE (email)
);

CREATE TABLE page_views (
    id SERIAL NOT NULL, 
    path VARCHAR(300) NOT NULL, 
    referrer VARCHAR(500), 
    bot_id INTEGER, 
    product_id INTEGER, 
    created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    CONSTRAINT pk_page_views PRIMARY KEY (id)
);

CREATE INDEX ix_page_views_bot_id ON page_views (bot_id);

CREATE INDEX ix_page_views_created_at ON page_views (created_at);

CREATE INDEX ix_page_views_path ON page_views (path);

CREATE INDEX ix_page_views_product_id ON page_views (product_id);

CREATE TABLE portfolio_projects (
    id SERIAL NOT NULL, 
    slug VARCHAR(120) NOT NULL, 
    title VARCHAR(160) NOT NULL, 
    summary VARCHAR(400) NOT NULL, 
    body TEXT NOT NULL, 
    category VARCHAR(60), 
    stack JSON NOT NULL, 
    cover_image VARCHAR(500), 
    media JSON NOT NULL, 
    live_url VARCHAR(500), 
    repo_url VARCHAR(500), 
    is_featured BOOLEAN NOT NULL, 
    is_published BOOLEAN NOT NULL, 
    sort_order INTEGER NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    CONSTRAINT pk_portfolio_projects PRIMARY KEY (id)
);

CREATE UNIQUE INDEX ix_portfolio_projects_slug ON portfolio_projects (slug);

CREATE TABLE site_settings (
    key VARCHAR(100) NOT NULL, 
    value JSON, 
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    CONSTRAINT pk_site_settings PRIMARY KEY (key)
);

CREATE TABLE testimonials (
    id SERIAL NOT NULL, 
    name VARCHAR(120) NOT NULL, 
    role VARCHAR(160), 
    quote TEXT NOT NULL, 
    avatar_url VARCHAR(500), 
    rating INTEGER NOT NULL, 
    sort_order INTEGER NOT NULL, 
    is_published BOOLEAN NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    CONSTRAINT pk_testimonials PRIMARY KEY (id)
);

CREATE TABLE users (
    id SERIAL NOT NULL, 
    email VARCHAR(320) NOT NULL, 
    password_hash VARCHAR(255), 
    name VARCHAR(120), 
    is_active BOOLEAN NOT NULL, 
    last_login_at TIMESTAMP WITH TIME ZONE, 
    created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    CONSTRAINT pk_users PRIMARY KEY (id)
);

CREATE UNIQUE INDEX ix_users_email ON users (email);

CREATE TABLE bot_commands (
    id SERIAL NOT NULL, 
    bot_id INTEGER NOT NULL, 
    discord_command_id VARCHAR(32) NOT NULL, 
    guild_id VARCHAR(32), 
    name VARCHAR(100) NOT NULL, 
    description VARCHAR(300), 
    type INTEGER NOT NULL, 
    options JSON NOT NULL, 
    is_hidden BOOLEAN NOT NULL, 
    synced_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    CONSTRAINT pk_bot_commands PRIMARY KEY (id), 
    CONSTRAINT fk_bot_commands_bot_id_bots FOREIGN KEY(bot_id) REFERENCES bots (id) ON DELETE CASCADE, 
    CONSTRAINT uq_bot_commands_bot_cmd UNIQUE (bot_id, discord_command_id)
);

CREATE INDEX ix_bot_commands_bot_id ON bot_commands (bot_id);

CREATE TABLE bot_inquiries (
    id SERIAL NOT NULL, 
    discord_username VARCHAR(100) NOT NULL, 
    email VARCHAR(320) NOT NULL, 
    server_size VARCHAR(40) NOT NULL, 
    purpose TEXT NOT NULL, 
    features TEXT NOT NULL, 
    budget VARCHAR(60) NOT NULL, 
    timeline VARCHAR(60) NOT NULL, 
    reference_bot_id INTEGER, 
    status VARCHAR(16) NOT NULL, 
    admin_notes TEXT, 
    ip VARCHAR(64), 
    created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    CONSTRAINT pk_bot_inquiries PRIMARY KEY (id), 
    CONSTRAINT fk_bot_inquiries_reference_bot_id_bots FOREIGN KEY(reference_bot_id) REFERENCES bots (id) ON DELETE SET NULL
);

CREATE INDEX ix_bot_inquiries_status ON bot_inquiries (status);

CREATE TABLE magic_link_tokens (
    id SERIAL NOT NULL, 
    user_id INTEGER NOT NULL, 
    token_hash VARCHAR(64) NOT NULL, 
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    used_at TIMESTAMP WITH TIME ZONE, 
    CONSTRAINT pk_magic_link_tokens PRIMARY KEY (id), 
    CONSTRAINT fk_magic_link_tokens_user_id_users FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE, 
    CONSTRAINT uq_magic_link_tokens_token_hash UNIQUE (token_hash)
);

CREATE INDEX ix_magic_link_tokens_user_id ON magic_link_tokens (user_id);

CREATE TABLE products (
    id SERIAL NOT NULL, 
    slug VARCHAR(120) NOT NULL, 
    name VARCHAR(160) NOT NULL, 
    tagline VARCHAR(300), 
    description TEXT NOT NULL, 
    features JSON NOT NULL, 
    category VARCHAR(32) NOT NULL, 
    sell_type VARCHAR(32) NOT NULL, 
    price_cents INTEGER NOT NULL, 
    currency VARCHAR(3) NOT NULL, 
    media JSON NOT NULL, 
    deliverable_key VARCHAR(500), 
    deliverable_filename VARCHAR(255), 
    version VARCHAR(40), 
    changelog TEXT, 
    is_published BOOLEAN NOT NULL, 
    is_featured BOOLEAN NOT NULL, 
    is_bot BOOLEAN NOT NULL, 
    bot_id INTEGER, 
    sales_count INTEGER NOT NULL, 
    sort_order INTEGER NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    CONSTRAINT pk_products PRIMARY KEY (id), 
    CONSTRAINT fk_products_bot_id_bots FOREIGN KEY(bot_id) REFERENCES bots (id) ON DELETE SET NULL
);

CREATE INDEX ix_products_bot_id ON products (bot_id);

CREATE INDEX ix_products_category ON products (category);

CREATE INDEX ix_products_is_published ON products (is_published);

CREATE UNIQUE INDEX ix_products_slug ON products (slug);

CREATE TABLE doc_pages (
    id SERIAL NOT NULL, 
    slug VARCHAR(160) NOT NULL, 
    title VARCHAR(200) NOT NULL, 
    section VARCHAR(60) NOT NULL, 
    body TEXT NOT NULL, 
    product_id INTEGER, 
    bot_id INTEGER, 
    sort_order INTEGER NOT NULL, 
    is_published BOOLEAN NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    CONSTRAINT pk_doc_pages PRIMARY KEY (id), 
    CONSTRAINT fk_doc_pages_bot_id_bots FOREIGN KEY(bot_id) REFERENCES bots (id) ON DELETE SET NULL, 
    CONSTRAINT fk_doc_pages_product_id_products FOREIGN KEY(product_id) REFERENCES products (id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX ix_doc_pages_slug ON doc_pages (slug);

CREATE TABLE orders (
    id SERIAL NOT NULL, 
    public_id VARCHAR(36) NOT NULL, 
    user_id INTEGER, 
    email VARCHAR(320) NOT NULL, 
    product_id INTEGER, 
    product_name VARCHAR(160) NOT NULL, 
    amount_cents INTEGER NOT NULL, 
    currency VARCHAR(3) NOT NULL, 
    status VARCHAR(16) NOT NULL, 
    stripe_session_id VARCHAR(255), 
    stripe_payment_intent VARCHAR(255), 
    paid_at TIMESTAMP WITH TIME ZONE, 
    download_expires_at TIMESTAMP WITH TIME ZONE, 
    download_count INTEGER NOT NULL, 
    last_emailed_at TIMESTAMP WITH TIME ZONE, 
    refund_notes TEXT, 
    admin_notes TEXT, 
    hosting_status VARCHAR(16) NOT NULL, 
    hosting_server_id VARCHAR(32), 
    created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    CONSTRAINT pk_orders PRIMARY KEY (id), 
    CONSTRAINT fk_orders_product_id_products FOREIGN KEY(product_id) REFERENCES products (id) ON DELETE SET NULL, 
    CONSTRAINT fk_orders_user_id_users FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE SET NULL, 
    CONSTRAINT uq_orders_public_id UNIQUE (public_id), 
    CONSTRAINT uq_orders_stripe_session_id UNIQUE (stripe_session_id)
);

CREATE INDEX ix_orders_email ON orders (email);

CREATE INDEX ix_orders_product_id ON orders (product_id);

CREATE INDEX ix_orders_status ON orders (status);

CREATE INDEX ix_orders_stripe_payment_intent ON orders (stripe_payment_intent);

CREATE INDEX ix_orders_user_id ON orders (user_id);

CREATE TABLE reviews (
    id SERIAL NOT NULL, 
    bot_id INTEGER, 
    product_id INTEGER, 
    user_id INTEGER NOT NULL, 
    author_name VARCHAR(120) NOT NULL, 
    rating INTEGER NOT NULL, 
    body TEXT NOT NULL, 
    is_approved BOOLEAN NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    CONSTRAINT pk_reviews PRIMARY KEY (id), 
    CONSTRAINT fk_reviews_bot_id_bots FOREIGN KEY(bot_id) REFERENCES bots (id) ON DELETE CASCADE, 
    CONSTRAINT fk_reviews_product_id_products FOREIGN KEY(product_id) REFERENCES products (id) ON DELETE CASCADE, 
    CONSTRAINT fk_reviews_user_id_users FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX ix_reviews_bot_id ON reviews (bot_id);

CREATE INDEX ix_reviews_product_id ON reviews (product_id);

INSERT INTO alembic_version (version_num) VALUES ('0001') RETURNING alembic_version.version_num;

-- Running upgrade 0001 -> 0002

ALTER TABLE products ADD COLUMN external_download_url VARCHAR(1000);

UPDATE alembic_version SET version_num='0002' WHERE alembic_version.version_num = '0001';

-- Running upgrade 0002 -> 0003

ALTER TABLE bots ADD COLUMN live_stats JSON;

ALTER TABLE bots ADD COLUMN live_stats_at TIMESTAMP WITH TIME ZONE;

UPDATE alembic_version SET version_num='0003' WHERE alembic_version.version_num = '0002';

COMMIT;

-- Lock Supabase's auto-generated public REST API out of every table.
-- The website connects as the database owner (postgres), which bypasses RLS, so it keeps working.
ALTER TABLE public.alembic_version ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discord_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.magic_link_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doc_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;