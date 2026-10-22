# Order testing

Use the [full test app](https://pipeline-alberta-drawing-inner.trycloudflare.com/menu.html). The [GitHub Pages entry](https://shingenn5.github.io/Luigi-s-Capstone/) forwards to it. This is a capstone test environment: sample prices, no payment collection, no tax, and no food fulfillment.

## Customer order

1. Choose a pizza size, toppings (regular or double), sauce/cheese, and quantity. Add a drink if wanted.
2. Select **Review your order**. Check quantities and subtotal.
3. Follow the sign-in link. Create a customer account or use an existing account on this test server. The cart stays with you.
4. Enter the order name and phone number, choose Pickup or Dine-in, then select **Place order**.
5. Check the confirmation number and **Your recent orders**. A matching New ticket appears in the employee kitchen. Keep checkout open to watch progress.

## Kitchen and phone orders

Open [Employee login](https://pipeline-alberta-drawing-inner.trycloudflare.com/employee-login.html) in another tab. Use the cloud employee credentials in the private, ignored `demo-dist/cloud-login.txt` handover. The public server does not use the laptop demo password.

- Move a pizza ticket through New → Preparing → In oven → Ready → Complete handoff. Progress appears automatically on the customer's order page.
- Drink-only tickets skip the oven. Timers record elapsed time; staff advances every stage manually.
- Use **New order** for phone/counter entry, including optional dine-in table and kitchen notes.
- Try cancellation with a reason and recall. Completed/cancelled tickets appear in searchable history.

## Recovery checks

- Refresh before submitting: the cart should remain. Refresh afterward: the saved order should appear in history with its original number.
- If sending fails, retry the unchanged draft. The server returns the original ticket if it already saved the order.
- If the session expires, use **Log in again**. The cart remains available after sign-in.
- Try a phone-sized screen and keyboard navigation. Test accounts and orders persist on this server across app restarts.

For local testing run `npm run demo`, then open the printed URL. Local employee credentials are `admin` / `adminadmin` unless that existing account was changed. Use `npm run demo:lan` to test from a phone on the same network. Local and cloud accounts/data are separate.

The public address uses a temporary Cloudflare tunnel. A tunnel restart can change it; see [deployment operations](deploy/gcp/LIVE-DEMO.md). This is ready for acceptance testing; restaurant-approved prices, tax, payments, delivery, and external notifications remain outside this test.
