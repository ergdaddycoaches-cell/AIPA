# Messaging environment variables

Put these in the Xano workspace **AIPA** (workspace id 3), under the environment variables for that workspace. Leave a value blank until that account exists. The family timeline already accepts messages through the stub, which does not read these.

The webhook URLs below are not environment variables. They are the addresses to paste into Twilio and Resend when those accounts are ready.

## Twilio

| Variable | What to paste |
|---|---|
| `TWILIO_ACCOUNT_SID` | The Account SID, starting with `AC`. |
| `TWILIO_AUTH_TOKEN` | The auth token. Used to check that a webhook post really came from Twilio. |
| `TWILIO_FROM_NUMBER` | The Twilio number families text and hear when you call, in E.164, such as `+18332472482`. |
| `TWILIO_API_KEY_SID` | An API key SID, starting with `SK`. Used to mint the browser dialer token. |
| `TWILIO_API_KEY_SECRET` | The secret for that API key. Stays in Xano. The browser only receives a short-lived token. |
| `TWILIO_TWIML_APP_SID` | The TwiML App SID, starting with `AP`. Its voice URL is the call webhook below. |
| `TWILIO_WEBHOOK_URL` | Optional. The exact URL Twilio calls for texts. Set this only if signature checks fail. Defaults to the text webhook below. |
| `TWILIO_VOICE_WEBHOOK_URL` | Optional. The exact voice URL Twilio signs for the browser dialer. Set this only if call setup is rejected. Defaults to the dialer voice webhook below. |
| `TWILIO_INCOMING_WEBHOOK_URL` | Optional. The exact URL Twilio signs when someone calls the toll-free number. Set this only if the greeting is rejected. Defaults to the incoming webhook below. |

Twilio webhook, for both “A message comes in” and the status callback:

`https://xmr6-ssay-w0v9.n7e.xano.io/api:mXXl9fOY/hooks/twilio`

Until `TWILIO_AUTH_TOKEN` is set, that address accepts the post and does not write a timeline row.

Voice webhook, pasted on the TwiML App as the voice request URL:

`https://xmr6-ssay-w0v9.n7e.xano.io/api:mXXl9fOY/hooks/twilio-voice`

That address is what the browser dialer asks Twilio to call. Until `TWILIO_AUTH_TOKEN` and `TWILIO_FROM_NUMBER` are set, it hangs up and does not dial. Leave this on the TwiML App. Do not put it on the toll-free number.

Toll-free number, for “A call comes in”:

`https://xmr6-ssay-w0v9.n7e.xano.io/api:mXXl9fOY/hooks/twilio-incoming`

That greeting records a voicemail. Twilio then posts the recording and the transcript to:

`https://xmr6-ssay-w0v9.n7e.xano.io/api:mXXl9fOY/hooks/twilio-voicemail`

A caller whose number matches a family cell, including a guest, is filed on that family’s timeline and marked for a call back. Any other number waits in Needs a family until someone attaches it. Until `TWILIO_AUTH_TOKEN` is set, the toll-free greeting says a message cannot be taken, and the voicemail address does not write a row.

If the toll-free number already records voicemail somewhere else in Twilio, point that recording status callback and the transcription callback at the voicemail address above.

## Resend

| Variable | What to paste |
|---|---|
| `RESEND_API_KEY` | The API key, starting with `re_`. Used to read the body of a received email, and later to send. |
| `RESEND_WEBHOOK_SECRET` | The webhook signing secret, starting with `whsec_`. |
| `RESEND_FROM_EMAIL` | The From address on follow-ups, such as `hello@goaipa.com`. |
| `RESEND_REPLY_DOMAIN` | The domain that receives replies, such as `reply.goaipa.com`. Point that domain’s mail at Resend. |

Resend webhook:

`https://xmr6-ssay-w0v9.n7e.xano.io/api:mXXl9fOY/hooks/resend`

Subscribe to `email.sent`, `email.delivered`, `email.bounced`, `email.failed`, and `email.received`.

Until `RESEND_WEBHOOK_SECRET` is set, that address accepts the post and does not write a timeline row.

When a follow-up is sent, set a tag named `registration_id` to the Family 1:1 reservation id. Set Reply-To to `family+{id}@` plus `RESEND_REPLY_DOMAIN`, so a reply still attaches if they write from another address.

## What each event becomes

| Event | Timeline line | Counts as a touch |
|---|---|---|
| Inbound text, or a text that was sent or delivered | Text received, or Text sent | Yes |
| `email.sent` or `email.delivered` | Email sent | Yes |
| `email.received` | Email received | Yes |
| Bounce, failure, or undelivered | Email bounced, Email failed, or Text failed | No |
| Answered call | Called | Yes |
| Toll-free voicemail | Voicemail, and the family is marked for a call back | Yes |
| No answer, busy, failed, or canceled call | No answer, Busy, or Call failed | No |

A message that matches no family cell or email is kept off the timelines and listed as unmatched. The same Twilio SID or Resend email id is stored once.

## After the secrets are in

Both addresses answer `{ "ok": false, "configured": false }` until the matching secret is set, and they do not write a row. Once the secret is set, a post without a valid signature is rejected.

Twilio signs the full URL plus every form field. If a real text is rejected, set `TWILIO_WEBHOOK_URL` to the exact URL shown in the Twilio console.

Resend signs the raw request body. If a real Resend post is rejected after `RESEND_WEBHOOK_SECRET` is set, say so. The check has to use that raw body, and a parsed copy of the JSON will not match.
