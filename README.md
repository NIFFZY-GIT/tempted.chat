This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Admin Dashboard Access

Admin access is role-based from Firestore.

1. Open Firestore collection `users`.
2. Create or update a document where document ID is the user's auth UID.
3. Set field `role` to `admin`.

Example document:

```json
{
	"role": "admin"
}
```

When a signed-in user has `users/{uid}.role = "admin"`, they are redirected to `/admin`.

## Scheduled Room Cleanup (Server-Side)

This project now includes a Cloud Function that automatically removes stale/orphaned chat rooms:

- Function: `cleanupOrphanRooms`
- Schedule: every 10 minutes
- Deletes:
	- ended rooms older than 10 minutes
	- active rooms with no presence activity for 30 minutes
	- related `waitingUsers` entries for the room
	- related Storage files under `chatUploads/{roomId}/`

Deploy steps:

```bash
cd functions
npm install
cd ..
firebase deploy --only functions
```

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
