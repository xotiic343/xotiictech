import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Vending X — Bot Setup Guide",
  description: "Complete setup guide for running the Vending X bot on your own Discord server.",
};

export default function SetupPage() {
  return (
    <section className="container-x py-12">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 border-b border-line pb-6">
          <h1 className="font-display text-3xl font-black tracking-wider text-blood">
            VENDING X — BOT SETUP
          </h1>
          <p className="mt-2 text-sm text-muted">
            Thank you for purchasing Bot Access. Follow the steps below to get Vending X running on your server.
          </p>
        </div>

        <div className="space-y-8 text-sm text-neutral-300">
          {/* Requirements */}
          <Section title="1. Requirements">
            <ul className="list-inside list-disc space-y-1 text-muted">
              <li>Python <Code>3.10+</Code></li>
              <li>A Discord Application & Bot Token</li>
              <li>A hosting platform (Discloud, Railway, VPS, etc.)</li>
              <li>pip (Python package manager)</li>
            </ul>
          </Section>

          {/* Create Bot */}
          <Section title="2. Create a Discord Bot">
            <ol className="list-inside list-decimal space-y-2 text-muted">
              <li>
                Go to the{" "}
                <a href="https://discord.com/developers/applications" target="_blank" rel="noopener noreferrer" className="text-blood hover:underline">
                  Discord Developer Portal
                </a>
              </li>
              <li>Click <Strong>New Application</Strong> and give it a name</li>
              <li>Go to the <Strong>Bot</Strong> tab</li>
              <li>Click <Strong>Reset Token</Strong> and copy the token — save it somewhere safe</li>
              <li>
                Enable these <Strong>Privileged Gateway Intents</Strong>:
                <ul className="ml-6 mt-1 list-disc space-y-0.5">
                  <li>Presence Intent</li>
                  <li>Server Members Intent</li>
                  <li>Message Content Intent</li>
                </ul>
              </li>
              <li>
                Go to <Strong>OAuth2 &rarr; URL Generator</Strong>, select scopes: <Code>bot</Code>{" "}
                + <Code>applications.commands</Code>
              </li>
              <li>
                Under Bot Permissions select: <Code>Send Messages</Code>, <Code>Embed Links</Code>,{" "}
                <Code>Attach Files</Code>, <Code>Read Message History</Code>,{" "}
                <Code>Use Slash Commands</Code>, <Code>Manage Roles</Code>
              </li>
              <li>Copy the generated URL and invite the bot to your server</li>
            </ol>
          </Section>

          {/* File Structure */}
          <Section title="3. File Structure">
            <p className="mb-2 text-muted">Your bot comes with this structure:</p>
            <pre className="overflow-x-auto rounded border border-line bg-black/60 p-4 text-xs text-neutral-400">
{`vendingx/
├── bot/
│   ├── __init__.py
│   ├── bot.py          # Commands & cog
│   ├── views.py        # Discord UI views
│   ├── stock.py        # Stock file management
│   ├── access.py       # Premium access checks
│   ├── db.py           # SQLite database
│   ├── parser.py       # Text parser utilities
│   └── logging.py      # Vend logging / DM logs
├── web/
│   └── server.py       # Optional API server
├── stock/              # Drop .txt stock files here
│   ├── epicgames.txt
│   ├── steam.txt
│   └── premium_nitro.txt
├── data/               # Auto-created (database)
├── main.py             # Entry point
├── requirements.txt
└── .env                # Your secrets (never share)`}</pre>
          </Section>

          {/* Environment Variables */}
          <Section title="4. Environment Variables">
            <p className="mb-2 text-muted">
              Create a <Code>.env</Code> file in the root with:
            </p>
            <pre className="overflow-x-auto rounded border border-line bg-black/60 p-4 text-xs text-neutral-400">
{`# Required
DISCORD_BOT_TOKEN=your_bot_token_here
BOT_OWNER_ID=your_discord_user_id
MAIN_SERVER_ID=your_server_id

# Optional — set a premium role in your server
PREMIUM_ROLE_ID=your_premium_role_id

# Optional — website frontend URL (for buy links)
FRONTEND_URL=https://your-site.com

# Optional — API port (default 5000)
API_PORT=5000`}</pre>
            <div className="mt-3 rounded border border-blood/30 bg-blood/5 p-3 text-xs text-blood/80">
              <Strong>Never share your .env file or bot token.</Strong> Add{" "}
              <Code>.env</Code> to your <Code>.gitignore</Code>.
            </div>
          </Section>

          {/* Install & Run */}
          <Section title="5. Install & Run">
            <pre className="overflow-x-auto rounded border border-line bg-black/60 p-4 text-xs text-neutral-400">
{`# Install dependencies
pip install -r requirements.txt

# Run the bot
python main.py`}</pre>
            <p className="mt-2 text-muted">
              The bot will log in, sync slash commands, and start the auto-update loop.
            </p>
          </Section>

          {/* Stock Files */}
          <Section title="6. Adding Stock">
            <p className="mb-2 text-muted">
              Drop <Code>.txt</Code> files into the <Code>stock/</Code> folder.
              One item per line. The filename becomes the stock type.
            </p>
            <pre className="overflow-x-auto rounded border border-line bg-black/60 p-4 text-xs text-neutral-400">
{`# stock/epicgames.txt — one account per line
email:password
email2:password2

# stock/premium_nitro.txt — prefix with "premium_" for premium-only items
https://discord.gift/xxxxx
https://discord.gift/yyyyy`}</pre>
            <ul className="mt-2 list-inside list-disc space-y-1 text-muted">
              <li>Files starting with <Code>premium_</Code> require premium access to vend</li>
              <li>Stock is dispensed top-to-bottom (first line first)</li>
              <li>Empty/used lines are removed automatically</li>
              <li>Add new stock by appending lines to the files</li>
            </ul>
          </Section>

          {/* Commands */}
          <Section title="7. Bot Commands">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-line text-blood/80">
                    <th className="py-2 pr-4">Command</th>
                    <th className="py-2 pr-4">Access</th>
                    <th className="py-2">Description</th>
                  </tr>
                </thead>
                <tbody className="text-muted">
                  <tr className="border-b border-line/30">
                    <td className="py-2 pr-4"><Code>/vending</Code></td>
                    <td className="py-2 pr-4">Admin</td>
                    <td className="py-2">Post vending machine panel (beta or premium tier)</td>
                  </tr>
                  <tr className="border-b border-line/30">
                    <td className="py-2 pr-4"><Code>/setbuy</Code></td>
                    <td className="py-2 pr-4">Admin</td>
                    <td className="py-2">Post buy/pricing embed with Stripe buttons</td>
                  </tr>
                  <tr className="border-b border-line/30">
                    <td className="py-2 pr-4"><Code>/addstock</Code></td>
                    <td className="py-2 pr-4">Owner</td>
                    <td className="py-2">Add stock from a file attachment</td>
                  </tr>
                  <tr className="border-b border-line/30">
                    <td className="py-2 pr-4"><Code>/clearstock</Code></td>
                    <td className="py-2 pr-4">Owner</td>
                    <td className="py-2">Clear all stock for a type</td>
                  </tr>
                  <tr className="border-b border-line/30">
                    <td className="py-2 pr-4"><Code>/panel</Code></td>
                    <td className="py-2 pr-4">Owner</td>
                    <td className="py-2">View bot stats and stock overview</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4"><Code>/setup</Code></td>
                    <td className="py-2 pr-4">Admin</td>
                    <td className="py-2">Configure auto-update channels and roles</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Section>

          {/* Hosting */}
          <Section title="8. Hosting on Discloud">
            <ol className="list-inside list-decimal space-y-2 text-muted">
              <li>
                Create a <Code>discloud.config</Code> file:
                <pre className="mt-1 overflow-x-auto rounded border border-line bg-black/60 p-3 text-xs text-neutral-400">
{`ID=auto
TYPE=bot
MAIN=main.py
RAM=512
VERSION=v3.10
AUTORESTART=true`}</pre>
              </li>
              <li>
                Zip the entire <Code>vendingx/</Code> folder contents (not the folder itself):
                <pre className="mt-1 overflow-x-auto rounded border border-line bg-black/60 p-3 text-xs text-neutral-400">
{`# Contents of your zip:
main.py
requirements.txt
discloud.config
bot/
web/
stock/
data/`}</pre>
              </li>
              <li>Do <Strong>NOT</Strong> include <Code>.env</Code> in the zip</li>
              <li>
                Upload the zip at{" "}
                <a href="https://discloud.com" target="_blank" rel="noopener noreferrer" className="text-blood hover:underline">
                  discloud.com
                </a>
              </li>
              <li>Set your environment variables in Discloud&apos;s dashboard under your app settings</li>
              <li>Start the bot from the dashboard</li>
            </ol>
          </Section>

          {/* Auto Update */}
          <Section title="9. Auto-Update Channels">
            <p className="text-muted">
              The bot posts live stock embeds that update every 5 minutes. To set this up:
            </p>
            <ol className="mt-2 list-inside list-decimal space-y-1 text-muted">
              <li>Create two text channels (e.g. <Code>#beta-stock</Code> and <Code>#premium-stock</Code>)</li>
              <li>
                Use <Code>/setup</Code> in your server to configure which channels get updates
              </li>
              <li>The bot will automatically post and edit a single message in each channel</li>
            </ol>
          </Section>

          {/* Troubleshooting */}
          <Section title="10. Troubleshooting">
            <div className="space-y-3 text-muted">
              <div>
                <Strong>Commands not showing up?</Strong>
                <p className="mt-0.5">
                  Wait a few minutes for Discord to sync. If still missing, restart the bot — commands sync on startup.
                </p>
              </div>
              <div>
                <Strong>Bot goes offline on Discloud?</Strong>
                <p className="mt-0.5">
                  Check RAM usage. If exceeding 512MB, increase the RAM in your plan. Check logs for errors.
                </p>
              </div>
              <div>
                <Strong>Stock not loading?</Strong>
                <p className="mt-0.5">
                  Make sure <Code>.txt</Code> files are in the <Code>stock/</Code> folder with one item per line. Empty lines are skipped.
                </p>
              </div>
            </div>
          </Section>

          {/* Support */}
          <div className="mt-10 rounded border border-line bg-panel/50 p-6 text-center">
            <p className="text-sm text-muted">
              Need help? Join the{" "}
              <a
                href="https://discord.gg/xotiictech"
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-blood hover:underline"
              >
                XotiicTech Discord
              </a>{" "}
              for support.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-3 font-display text-lg font-bold tracking-wider text-white">{title}</h2>
      {children}
    </div>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return <code className="rounded bg-blood/10 px-1.5 py-0.5 font-mono text-xs text-blood">{children}</code>;
}

function Strong({ children }: { children: React.ReactNode }) {
  return <strong className="font-semibold text-neutral-200">{children}</strong>;
}
