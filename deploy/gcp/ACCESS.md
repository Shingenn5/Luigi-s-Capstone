# Team access to the Luigi VM

The app's customer/employee accounts, GitHub repository permissions, and Google Cloud VM permissions are separate. Sharing an employee login does not grant SSH access. Each teammate should use their own Google account and SSH identity.

## Audited state — October 21, 2026

Project `luigis-pizzeria-512320`, VM `luigis-demo`, zone `us-central1-a`:

- Only the project owner's Google account currently has a human IAM binding. No teammate IAM grants were found at project or instance scope. Service-account bindings are not human access.
- OS Login is not enabled at project or instance scope. Existing SSH access uses metadata keys and IAP.
- No service account is attached to this VM in the inspected configuration.
- Teammate grants are pending the owner's list of Google-account emails and the access level for each person. This document is preparation, not proof that anyone else can connect.

## Access setup

Prefer OS Login and IAP for individual identities. Before enabling OS Login, explicitly establish the owner's administrative OS Login permission and verify a new owner session through IAP. Enabling OS Login stops metadata SSH keys from being used; keep an existing administrative session open until the new connection works. Apply it to this VM rather than changing unrelated project VMs.

For each approved teammate, grant the following as appropriate:

| Need | Permission approach |
| --- | --- |
| Open an SSH session without sudo | `roles/compute.osLogin` |
| Deploy and administer the VM with sudo | `roles/compute.osAdminLogin` |
| Reach this VM through IAP | `roles/iap.tunnelResourceAccessor`, scoped to the VM and SSH port where possible |
| Find the project/VM in the console or CLI | Project-level role containing `compute.projects.get`, plus the instance discovery permissions needed by that connection method; Compute Viewer is a documented practical option |
| Use an attached VM service account | `roles/iam.serviceAccountUser` on that specific service account, only if one is attached |

An ordinary OS Login shell does not automatically grant access to protected app logs, `/etc/luigis.env`, or the SQLite data directory. Define any read-only operational/data access separately. Admin login includes sudo and therefore access to app credentials and customer records; grant it only to the people the owner identifies as administrators. Do not substitute project Owner/Editor for SSH roles or grant access to `allUsers`/`allAuthenticatedUsers`.

Once IAM and OS Login are configured, the teammate signs in with their own account and connects:

```text
gcloud auth login
gcloud compute ssh luigis-demo --project=luigis-pizzeria-512320 --zone=us-central1-a --tunnel-through-iap
```

Console entry: [Luigi VM details](https://console.cloud.google.com/compute/instancesDetail/zones/us-central1-a/instances/luigis-demo?project=luigis-pizzeria-512320). Select the correct signed-in Google account, then SSH. Each teammate must verify their own connection; an owner's successful SSH session does not prove teammate access. Check `id` and, for approved admins, `sudo -n true`. A policy listing alone is not an end-to-end access test.

## Find the database inside the VM

In an authorized administrator's SSH terminal:

```sh
sudo ls -lh /var/lib/luigis/
```

The database is `/var/lib/luigis/luigis.db`. It is a SQLite file, not a separate Cloud SQL service. Customer records are in the `Customer` table. Local testing uses a separate database. Do not publish database copies, passwords, SSH private keys, or the private cloud login handover to GitHub.

## References

- [Google Cloud OS Login setup and role requirements](https://docs.cloud.google.com/compute/docs/oslogin/set-up-oslogin)
- [Google Cloud IAP TCP forwarding and VM-scoped access](https://docs.cloud.google.com/iap/docs/using-tcp-forwarding)
