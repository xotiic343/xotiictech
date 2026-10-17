# Stripe setup

The store uses **Stripe Checkout** (hosted payment page). Prices come from your products in `/xotiic`, so you don't need to create Products or Prices in Stripe.

## 1. Test mode first

1. Create a Stripe account and keep the dashboard's **Test mode** toggle on.
2. **Developers → API keys:** copy the secret key (`sk_test_…`) and publishable key (`pk_test_…`).
3. In Render → `xotiictech-api` → Environment, set:
   - `STRIPE_SECRET_KEY=sk_test_…`
   - `STRIPE_PUBLISHABLE_KEY=pk_test_…`

## 2. Webhook

Fulfilment (marking orders paid, emailing the download link) happens in the webhook. The success page also reconciles once in case the webhook is slow.

1. **Developers → Webhooks → Add endpoint**
2. URL: `https://xotiictech.com/api/webhooks/stripe`
3. Events to send:
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `checkout.session.async_payment_failed`
   - `checkout.session.expired`
   - `charge.refunded`
4. Copy the **Signing secret** (`whsec_…`) into `STRIPE_WEBHOOK_SECRET` and redeploy.

Every webhook is signature-verified. Events with a bad signature get a 400 and are ignored.

### Local testing

```bash
stripe login
stripe listen --forward-to localhost:3000/api/webhooks/stripe   # prints a whsec_ for .env
stripe trigger checkout.session.completed                        # or buy with card 4242 4242 4242 4242
```

## 3. Test a purchase

1. In `/xotiic → Products`, create a product with a price and upload a deliverable file. Publish it.
2. Buy it on the site with card `4242 4242 4242 4242`, any future expiry date and any CVC.
3. You should land on `/success` with a **Download** button and receive the email (or see it in the API log if Resend isn't configured).
4. The order appears in `/xotiic → Orders`.

## 4. Refunds

Issue refunds from the Stripe dashboard. The `charge.refunded` webhook marks the order **refunded**, which disables its download links. Use the order's *Refund notes* field for your own records.

## 5. Going live

1. Complete Stripe account activation (business details, bank account).
2. Make sure `/terms`, `/privacy` and `/refund-policy` contain your real policies (edit them in `/xotiic → Site content → Legal pages`). Stripe reviews these.
3. Switch the dashboard to **Live mode**, then:
   - copy the live keys (`sk_live_…`, `pk_live_…`) into Render
   - create the **same webhook endpoint again in live mode** and use its new `whsec_…`
4. Redeploy. The admin dashboard badge changes from `stripe test` to `stripe live`.
