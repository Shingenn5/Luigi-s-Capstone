# Order testing

Use the [full test app](https://pipeline-alberta-drawing-inner.trycloudflare.com/menu.html). The [GitHub Pages entry](https://shingenn5.github.io/Luigi-s-Capstone/) forwards to it. This is a capstone test environment: sample prices, no payment collection, no tax, and no food fulfillment.

## Customer order

1. Choose a pizza size, toppings (regular or double), sauce/cheese, and quantity. Add a drink if wanted.
2. Select **Review your order**. Check quantities and subtotal.
3. Follow the sign-in link. Create a customer account or use an existing account on this test server. The cart stays with you.
4. Enter the order name and phone number, choose Pickup or Dine-in, and optionally add kitchen instructions (500 characters). Dine-in also offers a table reference (40 characters). Switching back to Pickup clears the table. Select **Place order**.
5. Check the confirmation number and select **Track your latest order** to reach its receipt and progress. The receipt retains your instructions and table. A matching New ticket appears in the employee kitchen. Keep checkout open to watch progress.

## Kitchen and phone orders

Open [Employee login](https://pipeline-alberta-drawing-inner.trycloudflare.com/employee-login.html) in another tab. Use the cloud employee credentials in the private, ignored `demo-dist/cloud-login.txt` handover. The public server does not use the laptop demo password.

- Move a pizza ticket through New → Preparing → In oven → Ready → Complete handoff. Progress appears automatically on the customer's order page.
- Drink-only tickets skip the oven. Timers record elapsed time; staff advances every stage manually.
- Use **New order** for phone/counter entry, including optional dine-in table and kitchen notes.
- Try cancellation with a reason and recall. Completed/cancelled tickets appear in searchable history.
- On a website ticket, confirm the customer's kitchen instructions and dine-in table match checkout. Expand **Contact and order details** to see **Order activity**, including recorded stage changes, employee names, times, and cancellation reasons. These staff details are unavailable to customer accounts.

## Queue timeout and ordering

- Open **Kitchen board** and switch **Order within each stage** between newest on top and newest on bottom. Each stage should reverse its ticket order; reload to confirm the selection is saved.
- Under **Kitchen settings and keyboard help**, confirm the default timeout is **120 minutes**. Unfinished orders at or beyond that age appear under **Timed out** with their original stages and staff actions. Completed/cancelled orders remain in history.
- Change the timeout and save. Both tabs and their counts should refresh; reload to confirm the saved value. Preferences apply to the current browser/device. Orders crossing the threshold move on the next successful kitchen poll.
- Test at desktop and phone widths and with keyboard controls. If a focused ticket times out, focus should move to a visible control.

## Employee and admin accounts

1. Sign in through **Employee login** using an admin account.
2. Open **Staff accounts**. Enter a display name, a unique username, a password and matching confirmation, then choose **Employee** or **Admin** and select **Create account**.
3. Sign out and sign in with the new credentials. Both roles can use the kitchen and phone-order screens; only admins see **Staff accounts** or can create accounts.
4. Try a duplicate username and mismatched passwords. The form should explain the error without creating an extra account.

For the first admin on a new server, run `npm run admin:create` in an interactive terminal using that server's database configuration. `npm run employee:create` also lets you choose either role. The local demo account keeps ordinary employee access; its username does not grant admin permissions. Password reset and changing an existing account's role are not included in this screen.

## Customer account updates

1. Sign in as a customer and place a labelled practice order. Stay on the homepage or menu, then use a separate staff session to advance the ticket.
2. Confirm **Updates** gains unread notifications for preparing, in the oven, ready, and handoff. For pizza, Ready says made, cut and boxed; a drink-only order goes from preparing to ready without an oven update.
3. Open Updates, check the latest message and recorded time, and follow **View order progress**. Recall/cancellation should add a correction/cancellation update without exposing staff notes.
4. Mark one message as read, reload or sign out/in, and confirm that read state remains. **Mark all as read** clears the displayed account backlog without swallowing a newer stage change that arrives afterward.
5. Sign in with another customer account and confirm those notifications are absent. Check phone and desktop layouts and keyboard focus after marking messages read.

## Recovery checks

- Refresh before submitting: the cart should remain. Refresh afterward: the saved order should appear in history with its original number.
- If sending fails, retry the unchanged draft. The server returns the original ticket if it already saved the order.
- If the session expires, use **Log in again**. The cart remains available after sign-in.
- Try a phone-sized screen and keyboard navigation. Test accounts and orders persist on this server across app restarts.

For local testing run `npm run demo`, then open the printed URL. Local employee credentials are `admin` / `adminadmin` unless that existing account was changed. Use `npm run demo:lan` to test from a phone on the same network. Local and cloud accounts/data are separate.

The public address uses a temporary Cloudflare tunnel. A tunnel restart can change it; see [deployment operations](deploy/gcp/LIVE-DEMO.md). This is ready for acceptance testing; restaurant-approved prices, tax, payments, delivery, and external notifications remain outside this test.
