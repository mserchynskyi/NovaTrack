# Security Specification

1. Data Invariants:
- A user account record must have a document ID matching the user's UID.
- Users can only read and write their own token record.
- The `userId` field inside the document must match the UID and the document ID.

2. The "Dirty Dozen" Payloads:
- Create account for self (allow)
- Create account for others (deny)
- Update account for others (deny)
- Get account of others (deny)
- Unauthenticated access (deny)
- Invalid schema (missing tokens) (deny)
- Missing userId field in payload (deny)
- Spoofing userId on create (deny)
- Update with invalid userId (deny)
- ...
