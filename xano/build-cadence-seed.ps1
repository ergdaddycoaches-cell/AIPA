$sign = "`n`nAging in Place Alliance`n833-AIPA-HUB"
$auto = "There's no obligation, and you're free to wait. We'll still be here."
$skip = "Or, if you'd rather talk it through privately, book an Ask Anything 1:1:`n{{one_to_one}}"
$stop = " Reply STOP to opt out."
$messages = New-Object System.Collections.Generic.List[object]
$sort = 20
function Add-Message($key, $name, $channel, $subject, $body, $hint) {
  $script:sort++
  $script:messages.Add([ordered]@{
    key = $key; name = $name; channel = $channel; subject = $subject
    body = $body; hint = $hint; sort = $script:sort
  }) | Out-Null
}
function Add-Email($key, $name, $subject, $body, $hint) { Add-Message $key $name 'email' $subject ($body + $sign) $hint }
function Add-Text($key, $name, $body, $hint) { Add-Message $key $name 'sms' '' ($body + $stop) $hint }
function Add-Call($key, $name, $body, $hint) { Add-Message $key $name 'call' '' $body $hint }

$h = 'Edit the copy here. The Cadences page decides when it goes out.'

Add-Email 'cad_react_1' 'Reactivation, introduction' 'A note from {{contractor}} and the Aging in Place Alliance' @"
Hi {{first_name}},

Some time ago you spoke with {{contractor}} about making changes to your home. Decisions like this deserve time, and there's no rush.

{{contractor}} has partnered with us, the Aging in Place Alliance, so homeowners can get plain, honest answers before deciding anything. Our guides are people in their 50s, 60s and 70s, so we understand the questions from the same side of the table.

Here's a short guide many people find useful: {{guide}}
{{library}}

Warm regards,
[Host name]
Aging in Place Alliance

P.S. We host a free Live Q&A where you can ask anything, with no sales pitch. The next one is [Day, Date] at [Time]. Save a seat: {{live_qa}}
"@ $h
Add-Email 'cad_react_2' 'Reactivation, why people wait' 'Is it too early to think about this?' @"
Hi {{first_name}},

It's the question we hear most. The honest answer is that the best time to plan is while it's still a choice, not a necessity.

Planning early doesn't mean doing everything at once. Many people make one or two changes now and save the rest for later.

This short guide explains how: {{guide}}
{{library}}

If a question comes to mind, just reply. A real person reads every note.

[Host name]
"@ $h
Add-Email 'cad_react_3' 'Reactivation, Live Q&A invite' "You're invited: Live Q&A on [Date]" @"
Hi {{first_name}},

I'd like to invite you to our next Live Q&A.

[Day, Date] at [Time], about 45 minutes, from your own computer or tablet.

We'll cover what changes are worth making, what they really cost, and how to plan them without upheaval. You can ask questions or simply listen. No one will try to sell you anything.

Save my seat: {{live_qa}}

No obligation, of course. If the timing isn't right, that's perfectly fine.

[Host name]

P.S. If you'd rather talk it through privately, you can book an Ask Anything 1:1 instead. Book a 1:1: {{one_to_one}}
"@ $h
Add-Email 'cad_react_4' 'Reactivation, three ideas' 'Three ideas that keep people waiting' @"
Hi {{first_name}},

We hear the same three worries again and again. Each one is understandable, and each one is worth a second look.

"It will look like a hospital." Today's grab bars, showers and lighting can look like any well-designed home. Many people's guests never notice.

"It all has to be done at once." Most people start with one or two changes and plan the rest over time.

"It's for people who already need it." The changes are easiest to make while they're still a choice, not after a fall.

More on each: {{library}}

[Host name]

P.S. Our next Live Q&A is [Day, Date] at [Time]. Save a seat: {{live_qa}} Or book a private Ask Anything 1:1. Book a 1:1: {{one_to_one}}
"@ $h
Add-Email 'cad_react_5' 'Reactivation, one question' "What's your one question?" @"
Hi {{first_name}},

If you could ask one question about making your home easier to live in for the long run, what would it be?

Just reply to this email with your question. I'll answer it at our next Live Q&A on [Day, Date] at [Time], and I won't use your name.

Save my seat: {{live_qa}}

Of course, you're under no obligation. I'm happy to answer by email too.

[Host name]

P.S. If you'd prefer a private conversation, book an Ask Anything 1:1. {{one_to_one}}
"@ $h
Add-Email 'cad_react_6' 'Reactivation, the common mistake' 'The most common mistake we see' @"
Hi {{first_name}},

It isn't choosing the wrong grab bar or tile. It's waiting until after a fall, when every decision has to be made in a hurry.

Here's a short guide on making changes on your own schedule: {{guide}}
{{library}}

[Host name]
"@ $h
Add-Email 'cad_react_7' 'Reactivation, close the file' 'Should I close your file?' @"
Hi {{first_name}},

I don't want to fill your inbox with notes you don't need, so I'll ask simply. Just reply with a letter:

A. Save me a seat at the next Live Q&A
B. Not now, but check back later
C. Please close my file

Any answer is fine, and I'll respect it.

Thank you,
[Host name]
"@ $h

Add-Email 'cad_attend_confirm' 'Registered, confirmation' "You're registered: Live Q&A on [Date]" @"
Hi {{first_name}},

You're all set for [Day, Date] at [Time].

Join here: {{zoom}}
A calendar invitation is attached so it's easy to remember.

If there's something you'd like me to cover, reply with your question and I'll make sure we get to it.

See you then,
[Host name]
"@ $h
Add-Call 'cad_attend_call' 'Registered, host reminder call' @"
Call from the host, 24 hours before the Live Q&A.

Hello, is this {{first_name}}? This is [Host name] from the Aging in Place Alliance. I'm calling to say I'm looking forward to seeing you at tomorrow's Live Q&A at [Time]. Do you have the link handy, or shall I send it again? Is there anything in particular you'd like me to cover? Wonderful. See you tomorrow.

If nobody answers, leave this voicemail, then send the text:

Hello {{first_name}}, it's [Host name] from the Aging in Place Alliance. Just a friendly reminder about tomorrow's Live Q&A at [Time]. I'll text you the link. Look forward to seeing you.
"@ $h
Add-Text 'cad_attend_call_sms' 'Registered, text if the reminder call is missed' "Hi {{first_name}}, it's [Host name] from the Aging in Place Alliance. Looking forward to seeing you at tomorrow's Live Q&A at [Time]. Here's the link: {{zoom}}" $h
Add-Email 'cad_attend_day' 'Registered, one day before' 'Tomorrow at [Time]: Live Q&A' @"
Hi {{first_name}},

A quick reminder that our Live Q&A is tomorrow, [Day] at [Time].

Join here: {{zoom}}

[Host name]
"@ $h
Add-Email 'cad_attend_hour' 'Registered, one hour before' 'We start in one hour' @"
Hi {{first_name}}, our Live Q&A begins at [Time]. Join here: {{zoom}}
"@ $h
Add-Text 'cad_attend_hour_sms' 'Registered, text one hour before' "Hi {{first_name}}, our Live Q&A starts in one hour, at [Time]. Join here: {{zoom}}. [Host name]" $h
Add-Email 'cad_attend_now' 'Registered, starting now' 'We''re starting now' @"
Hi {{first_name}}, we're starting now. Come in whenever you're ready: {{zoom}}
"@ $h
Add-Text 'cad_attend_now_sms' 'Registered, text as it starts' "We're starting now, {{first_name}}. Join here: {{zoom}}. [Host name]" $h

Add-Email 'cad_noshow_1' 'Missed Live Q&A, same day' 'Sorry we missed you' @"
Hi {{first_name}},

We missed you at today's Live Q&A. No worries, life happens.

Here's a short clip of the question that came up most: {{library}}

The next session is [Day, Date] at [Time]. Save a seat: {{live_qa}}

Or, if a private conversation suits you better, book an Ask Anything 1:1. {{one_to_one}}

[Host name]
"@ $h
Add-Email 'cad_noshow_2' 'Missed Live Q&A, next date' 'A seat for you on [Date]' @"
Hi {{first_name}},

I'd be glad to save you a seat at our next Live Q&A: [Day, Date] at [Time].

Save my seat: {{live_qa}}

No obligation. If now isn't the right time, that's fine too.

[Host name]

P.S. Prefer one-on-one? Book an Ask Anything 1:1: {{one_to_one}}
"@ $h
Add-Email 'cad_noshow_3' 'Missed Live Q&A, a guide' '{{guide}}' @"
Hi {{first_name}},

I thought you might find this useful: {{guide}}
{{library}}

[Host name]

P.S. The next Live Q&A is [Day, Date] at [Time]. Save a seat: {{live_qa}}
"@ $h

Add-Call 'cad_attendee_call' 'Attendee, host call' @"
Call from the host who ran the Live Q&A, two days later.

Hello {{first_name}}, this is [Host name] from the Aging in Place Alliance. Thank you for joining the Live Q&A on [Day]. I wanted to ask if anything came up afterward that you'd like to talk through? Many people find it helpful to have a short private conversation about their own home. Would you like me to set up an Ask Anything 1:1? I have [time option 1] or [time option 2]. And if now isn't the right time, that's perfectly fine.

If nobody answers, leave this voicemail, then send the text:

Hello {{first_name}}, it's [Host name] from the Aging in Place Alliance. Thank you for joining us on [Day]. I'm calling to see if any questions came up. I'll send you a short text, and you can always reach us at 833-AIPA-HUB.
"@ $h
Add-Email 'cad_attendee_guide' 'Attendee, a guide from the session' 'More on [topic from the session]' @"
Hi {{first_name}},

The question we heard most at the session was about [topic from the session]. Here's a short guide that goes a bit deeper: {{guide}}
{{library}}

[Host name]

P.S. If you'd like to talk about your own home, book an Ask Anything 1:1: {{one_to_one}}
"@ $h
Add-Email 'cad_attendee_last' 'Attendee, last call for a 1:1' 'A few 1:1 times left this month' @"
Hi {{first_name}},

Our guides have a few Ask Anything 1:1 times left this month, and I wanted to make sure you had the chance.

About 30 minutes, about your home, at no cost. Your daughter or son is welcome to join.

Book my 1:1: {{one_to_one}}

There's no obligation, and you're free to wait. We'll still be here.

[Host name]
"@ $h

Add-Email 'cad_oto_confirm' 'Ask Anything 1:1, confirmation' 'Your Ask Anything 1:1 is confirmed' @"
Hi {{first_name}},

Your Ask Anything 1:1 is set for [Day, Date] at [Time]. A calendar invitation is attached.

You'll be speaking with [Guide name]. [Guide photo] [One line about the guide.]

You're welcome to invite your daughter or son to join. Just forward them this email. Here's the link: {{zoom}}

[Host name]
"@ $h
Add-Email 'cad_oto_day' 'Ask Anything 1:1, one day before' 'Tomorrow: your Ask Anything 1:1' @"
Hi {{first_name}}, a friendly reminder that you're speaking with [Guide name] tomorrow at [Time]. Join here: {{zoom}}
"@ $h
Add-Text 'cad_oto_day_sms' 'Ask Anything 1:1, text one day before' "Hi {{first_name}}, a reminder that your 1:1 with [Guide name] is tomorrow at [Time]. Link: {{zoom}}" $h
Add-Text 'cad_oto_soon_sms' 'Ask Anything 1:1, text one hour before' "Hi {{first_name}}, it's [Guide name]. Looking forward to talking with you at [Time]. Here's the link: {{zoom}}" $h
Add-Email 'cad_oto_soon_email' 'Ask Anything 1:1, email one hour before' 'Talk soon' @"
Hi {{first_name}}, it's [Guide name]. Looking forward to talking with you at [Time]. Here's the link: {{zoom}}
"@ $h

Add-Email 'cad_oto_miss_1' 'Missed Ask Anything 1:1, same day' 'Shall we find another time?' @"
Hi {{first_name}},

We missed each other today. Not a problem at all. Would you like to choose another time? {{one_to_one}}

[Guide name]
"@ $h
Add-Email 'cad_oto_miss_2' 'Missed Ask Anything 1:1, rebook' 'Another time for your Ask Anything 1:1' @"
Hi {{first_name}},

I'd be glad to find another time for your Ask Anything 1:1.

{{one_to_one}}

No obligation. If now isn't the right time, that's fine too.

[Guide name]
"@ $h
Add-Email 'cad_oto_miss_3' 'Missed Ask Anything 1:1, a guide' '{{guide}}' @"
Hi {{first_name}},

I thought you might find this useful: {{guide}}
{{library}}

[Guide name]

P.S. If you'd like another time, book an Ask Anything 1:1: {{one_to_one}}
"@ $h

Add-Email 'cad_visit_plan' 'After the 1:1, the plan' 'Your 10+ Year Freedom Plan' @"
Hi {{first_name}},

Thank you for the conversation today. Here's a summary of what we talked about, so you have it in one place.

Your home: [one or two lines]
What matters most to you: [in their own words]
Changes to consider now: [short list]
Changes that can wait: [short list]

Download your plan: [link]

When you're ready, the next step is a measuring visit at your home. [Book a visit]

[Guide name]
"@ $h
Add-Email 'cad_visit_guide' 'After the 1:1, the hesitation guide' 'About [their hesitation]' @"
Hi {{first_name}},

When we spoke, you mentioned [their hesitation in their words]. That's a very common concern, and a fair one.

This short guide addresses it directly: {{guide}}
{{library}}

If it raises any questions, just reply.

[Guide name]
"@ $h
Add-Call 'cad_visit_call' 'After the 1:1, guide call' @"
Call from the same guide who ran the Ask Anything 1:1, four days later.

Hello {{first_name}}, it's [Guide name]. I enjoyed our conversation on [Day]. Have any questions come up since then? The next step, whenever you're ready, is a measuring visit. Someone comes to your home, takes measurements and talks through options. It's about an hour, and you keep the measurements whatever you decide. I could arrange [time option 1] or [time option 2]. Would either suit you? And if you'd rather wait, that's perfectly fine.

If nobody answers, leave this voicemail, then send the text:

Hello {{first_name}}, it's [Guide name] from the Aging in Place Alliance. I enjoyed our talk on [Day] and wanted to see if any questions came up. I'll send a short text. You can always reach us at 833-AIPA-HUB.
"@ $h
Add-Email 'cad_visit_family' 'After the 1:1, note for adult children' 'For your family: what we talked about' @"
Hi {{first_name}},

Many people like to share their plan with their children. If that's helpful, simply forward this email.

---

For {{first_name}}'s family:

I'm [Guide name] from the Aging in Place Alliance. {{first_name}} and I recently talked about making their home easier to live in for the years ahead. Here's the plan we put together: [link]

The next step, if they choose, is a measuring visit at the home. You're welcome to be there. [Book a visit]

Questions are always welcome: 833-AIPA-HUB.

---

[Guide name]
"@ $h
Add-Email 'cad_visit_ask' 'After the 1:1, the measuring visit' 'A one-hour measuring visit' @"
Hi {{first_name}},

When you're ready, the next step is small: a measuring visit at your home.

- About an hour
- Measurements taken and options talked through
- You keep the measurements, whatever you decide
- No obligation

[Choose a time]

You're free to wait, of course. There's no deadline.

[Guide name]
"@ $h
Add-Email 'cad_visit_story' 'After the 1:1, what the visit is like' 'What happens at a measuring visit' @"
Hi {{first_name}},

It's natural to wonder what a visit will be like, so here it is, step by step:

1. A short conversation first. The estimator asks how you use your home and what matters to you.
2. Measurements. Doorways, the bathroom, steps, and anything else on your plan.
3. Options, not pressure. You hear what's possible and roughly what it costs.
4. Time to think. You keep the measurements, and no one asks you to decide on the spot.

You're welcome to have your daughter or son there too.

[Guide name]

P.S. When you're ready: [Book a measuring visit]
"@ $h
Add-Email 'cad_visit_last' 'After the 1:1, last ask' 'One last note from me' @"
Hi {{first_name}},

I don't want to keep nudging, so this is my last note about the visit for now.

If you'd like a measuring visit, you can choose a time here: [Book a visit]

If now isn't right, that's completely fine. You're free to wait, and we'll still be here. I'll send a useful guide now and then, and you can reach me anytime at 833-AIPA-HUB.

With respect,
[Guide name]
"@ $h

Add-Email 'cad_nurture_new_1' 'Nurture, first month' '{{guide}}' @"
Hi {{first_name}},

This month's guide: {{guide}}. [One sentence on why it's useful.]
{{library}}

[Host name]

Next Live Q&A: [Day, Date] at [Time]. Save a seat: {{live_qa}}
"@ $h
Add-Email 'cad_nurture_new_2' 'Nurture, second month' '{{guide}}' @"
Hi {{first_name}},

This month's guide: {{guide}}. [One sentence on why it's useful.]
{{library}}

[Host name]

Next Live Q&A: [Day, Date] at [Time]. Save a seat: {{live_qa}}
"@ $h
Add-Email 'cad_nurture_new_3' 'Nurture, third month' '{{guide}}' @"
Hi {{first_name}},

[One or two sentences introducing this month's guide.]
{{library}}

[Host name]

P.S. Our next Live Q&A is [Day, Date] at [Time]. Save a seat: {{live_qa}}

Next Live Q&A: [Day, Date] at [Time]. Save a seat: {{live_qa}}
"@ $h
Add-Email 'cad_nurture_qa_1' 'Nurture after a Live Q&A, first month' '{{guide}}' @"
Hi {{first_name}},

This month's guide: {{guide}}. [One sentence on why it's useful.]
{{library}}

[Host name]

Next Live Q&A: [Day, Date] at [Time]. Save a seat: {{live_qa}}
"@ $h
Add-Email 'cad_nurture_qa_2' 'Nurture after a Live Q&A, second month' '{{guide}}' @"
Hi {{first_name}},

[One or two sentences introducing this month's guide.]
{{library}}

[Host name]

P.S. Our next Live Q&A is [Day, Date] at [Time]. Save a seat: {{live_qa}}

Next Live Q&A: [Day, Date] at [Time]. Save a seat: {{live_qa}}
"@ $h
Add-Email 'cad_nurture_qa_3' 'Nurture after a Live Q&A, third month' 'An invitation for [Month]' @"
Hi {{first_name}},

Our next Live Q&A is [Day, Date] at [Time]. Bring a question, or just listen.

Save my seat: {{live_qa}}

No obligation. If now isn't the time, that's fine.

[Host name]

P.S. Prefer a private conversation? Book an Ask Anything 1:1: {{one_to_one}}

Next Live Q&A: [Day, Date] at [Time]. Save a seat: {{live_qa}}
"@ $h
Add-Email 'cad_nurture_visit_1' 'Nurture after a 1:1, soft month' '{{guide}}' @"
Hi {{first_name}},

[One or two sentences introducing this month's guide.]
{{library}}

[Host name]

P.S. Whenever you're ready, [Guide name] can arrange a measuring visit. [Book a visit]

Next Live Q&A: [Day, Date] at [Time]. Save a seat: {{live_qa}}
"@ $h
Add-Email 'cad_nurture_visit_2' 'Nurture after a 1:1, the visit' "Whenever you're ready" @"
Hi {{first_name}},

Just a gentle note that [Guide name] would be glad to arrange your measuring visit: about an hour, no obligation, and you keep the measurements.

[Choose a time]

You're free to wait, and we'll still be here.

[Host name]

Next Live Q&A: [Day, Date] at [Time]. Save a seat: {{live_qa}}
"@ $h

Add-Email 'cad_season_thanks' 'Seasonal, before Thanksgiving' 'Something to share with your family this Thanksgiving' @"
Hi {{first_name}},

When children come home for the holidays, they often notice things we've learned to work around.

If it would help, forward this short checklist. It shows what to look for, kindly and without fuss:

- Is the tub or shower easy to step in and out of?
- Are the stairs well lit, with a sturdy rail on both sides?
- Is there a clear, lit path from bed to bathroom at night?
- Any near-slips or stumbles lately?

Read the full checklist: {{library}}

Wishing you a warm Thanksgiving,
[Host name]
"@ $h
Add-Email 'cad_season_dec' 'Seasonal, early December' 'A holiday checklist worth sharing' @"
Hi {{first_name}},

As family gathers this month, here's a short checklist that makes a good conversation starter.

Read the checklist: {{library}}

Happy holidays,
[Host name]

P.S. Our next Live Q&A is [Day, Date] at [Time]. Save a seat: {{live_qa}}
"@ $h
Add-Email 'cad_season_jan' 'Seasonal, after the holidays' 'Did the holidays raise anything?' @"
Hi {{first_name}},

Holiday visits often bring up the conversation about the house: the stairs, the shower, the "what if." If that happened in your family, you're not alone.

Our next Live Q&A is a good place to start: [Day, Date] at [Time].

Save my seat: {{live_qa}}

Or, for a private conversation, book an Ask Anything 1:1: {{one_to_one}}

There's no obligation, and no rush.

[Host name]
"@ $h
Add-Email 'cad_season_jan_2' 'Seasonal, later in January' 'A calm way to start planning' @"
Hi {{first_name}},

If the holidays raised questions, this short guide shows how to plan in phases, starting with the one change that matters most: {{guide}}
{{library}}

[Host name]

P.S. When you'd like to talk it through, book an Ask Anything 1:1: {{one_to_one}}
"@ $h

$sequences = @(
  @{ key='reactivation'; name='Reactivation'; sort=1; goal='Rebuild trust with a lead that stalled, then get a Live Q&A registration. If they finish without registering, move them to monthly nurture.' }
  @{ key='attendance'; name='Attendance reminders'; sort=2; goal='Get someone who registered for a Live Q&A to show up. Set the session time to the start of that Live Q&A.' }
  @{ key='no_show'; name='No-show follow-up'; sort=3; goal='Bring back someone who registered and missed the Live Q&A. Do not send the replay to the general list.' }
  @{ key='attendee'; name='Attendee follow-up'; sort=4; goal='Book the Ask Anything 1:1 while the Live Q&A is still fresh. The day-of email is the existing invite. The day-2 text is the existing invite text, sent only if the call is not answered.' }
  @{ key='one_to_one'; name='Ask Anything 1:1 reminders'; sort=5; goal='Get someone who booked an Ask Anything 1:1 to show up. Set the session time to the start of that conversation.' }
  @{ key='one_to_one_miss'; name='Missed Ask Anything 1:1'; sort=6; goal='Rebook the Ask Anything 1:1 after a missed conversation. If this finishes without a booking, move them to monthly nurture.' }
  @{ key='visit'; name='After an Ask Anything 1:1'; sort=7; goal='Book the in-home visit for someone who wants to think about it. Every touch comes from the guide who ran the conversation. The day-4 text is the existing home-visit text, sent only if the call is not answered.' }
  @{ key='nurture_new'; name='Monthly nurture, not yet at a Live Q&A'; sort=8; goal='One email a month. The cycle is no ask, no ask, then a soft ask, and then it repeats. A hard ask goes out about every third month.' }
  @{ key='nurture_qa'; name='Monthly nurture, after a Live Q&A'; sort=9; goal='One email a month for someone who registered or attended. The cycle is no ask, soft ask, hard ask, and then it repeats.' }
  @{ key='nurture_visit'; name='Monthly nurture, after an Ask Anything 1:1'; sort=10; goal='One email a month. The cycle is a soft ask, then a hard ask for the visit, and then it repeats. These homeowners do not go inactive on their own.' }
  @{ key='seasonal'; name='Seasonal emails'; sort=11; goal='Sent around the holidays in addition to the regular cadence. Skip that person''s nearest regular email that week.' }
)

function Step($sequence, $sort, $when, $timing, $day, $hour, $month, $dom, $channel, $ask, $intent, $message, $companion, $calendar) {
  [ordered]@{
    sequence_key=$sequence; sort=$sort; when_label=$when; timing=$timing
    day_offset=$day; hour_offset=$hour; month=$month; day_of_month=$dom
    channel=$channel; ask=$ask; intent=$intent; message_key=$message
    companion_key=$companion; calendar_invite=[bool]$calendar
  }
}
$steps = @(
  (Step 'reactivation' 1 'Day 0' 'day' 0 0 0 0 'email' 'soft' 'Introduce AIPA through the contractor, include a useful guide, and put the next Live Q&A date in a P.S.' 'cad_react_1' '' $false)
  (Step 'reactivation' 2 'Day 3' 'day' 3 0 0 0 'email' 'none' 'A guide aimed at a common reason people stall: cost, doing it in phases, or whether it is too early.' 'cad_react_2' '' $false)
  (Step 'reactivation' 3 'Day 7' 'day' 7 0 0 0 'email' 'hard' 'A dedicated invite to a specific Live Q&A, with the Ask Anything 1:1 as a quieter second option.' 'cad_react_3' '' $false)
  (Step 'reactivation' 4 'Day 14' 'day' 14 0 0 0 'email' 'soft' 'Three ideas that keep people waiting: it will look like a hospital, it all has to be done at once, or it is only for people who already need it. Include the next Live Q&A date.' 'cad_react_4' '' $false)
  (Step 'reactivation' 5 'Day 21' 'day' 21 0 0 0 'email' 'hard' 'Ask them to reply with one question the host will answer live, and invite them to register.' 'cad_react_5' '' $false)
  (Step 'reactivation' 6 'Day 30' 'day' 30 0 0 0 'email' 'none' 'A guide, with no booking link.' 'cad_react_6' '' $false)
  (Step 'reactivation' 7 'Day 40' 'day' 40 0 0 0 'email' 'hard' 'The breakup email. Save me a seat, check back later, or close the file.' 'cad_react_7' '' $false)

  (Step 'attendance' 1 'Right after registering' 'day' 0 0 0 0 'email' '' 'Confirmation, the join link, and an invitation to reply with their question. Include a calendar invite.' 'cad_attend_confirm' '' $true)
  (Step 'attendance' 2 '24 hours before' 'event' 0 -24 0 0 'call' '' 'A personal reminder from the host. If nobody answers, leave a voicemail and send the text.' 'cad_attend_call' 'cad_attend_call_sms' $false)
  (Step 'attendance' 3 '24 hours before' 'event' 0 -24 0 0 'email' '' 'Reminder with the join link.' 'cad_attend_day' '' $false)
  (Step 'attendance' 4 '1 hour before' 'event' 0 -1 0 0 'email' '' 'Starting in an hour, with the join link, plus a text if they have agreed to texts.' 'cad_attend_hour' 'cad_attend_hour_sms' $false)
  (Step 'attendance' 5 'At start time' 'event' 0 0 0 0 'email' '' 'We are starting now, with the join link, plus a text if they have agreed to texts.' 'cad_attend_now' 'cad_attend_now_sms' $false)

  (Step 'no_show' 1 'Day 0' 'day' 0 0 0 0 'email' 'soft' 'Sorry we missed you. A short replay clip, the next Live Q&A date, and the Ask Anything 1:1 option.' 'cad_noshow_1' '' $false)
  (Step 'no_show' 2 'Day 4' 'day' 4 0 0 0 'email' 'hard' 'Invite them to the next Live Q&A, with the Ask Anything 1:1 option.' 'cad_noshow_2' '' $false)
  (Step 'no_show' 3 'Day 10' 'day' 10 0 0 0 'email' 'soft' 'A guide, with the next date in a P.S.' 'cad_noshow_3' '' $false)

  (Step 'attendee' 1 'Day 0' 'day' 0 0 0 0 'email' 'hard' 'Thank them, answer the question they submitted if they asked one, and include the booking link. Uses the existing Ask Anything 1:1 invite.' 'invite_qa' '' $false)
  (Step 'attendee' 2 'Day 2' 'day' 2 0 0 0 'call' 'hard' 'A personal call from the host who ran the session. If nobody answers, send the existing invite text.' 'cad_attendee_call' 'invite_qa_sms' $false)
  (Step 'attendee' 3 'Day 4' 'day' 4 0 0 0 'email' 'soft' 'A guide on whatever came up most in that session.' 'cad_attendee_guide' '' $false)
  (Step 'attendee' 4 'Day 7' 'day' 7 0 0 0 'email' 'hard' 'Last call for an Ask Anything 1:1 this month, with a real limit and the autonomy line.' 'cad_attendee_last' '' $false)

  (Step 'one_to_one' 1 'Right after booking' 'day' 0 0 0 0 'email' '' 'Confirmation, and an invitation to bring a daughter or son. Include a calendar invite.' 'cad_oto_confirm' '' $true)
  (Step 'one_to_one' 2 '24 hours before' 'event' 0 -24 0 0 'email' '' 'Reminder, plus a text if they have agreed to texts.' 'cad_oto_day' 'cad_oto_day_sms' $false)
  (Step 'one_to_one' 3 '1 hour before' 'event' 0 -1 0 0 'sms' '' 'Talk soon, with the join link. Send the email instead if they have not agreed to texts.' 'cad_oto_soon_sms' 'cad_oto_soon_email' $false)

  (Step 'one_to_one_miss' 1 'Day 0' 'day' 0 0 0 0 'email' 'soft' 'Sorry we missed you, with a link to rebook the Ask Anything 1:1.' 'cad_oto_miss_1' '' $false)
  (Step 'one_to_one_miss' 2 'Day 4' 'day' 4 0 0 0 'email' 'hard' 'Invite them to rebook the Ask Anything 1:1.' 'cad_oto_miss_2' '' $false)
  (Step 'one_to_one_miss' 3 'Day 10' 'day' 10 0 0 0 'email' 'soft' 'A guide, with the rebook link in a P.S.' 'cad_oto_miss_3' '' $false)

  (Step 'visit' 1 'Day 0' 'day' 0 0 0 0 'email' 'soft' 'A recap written as their 10+ Year Freedom Plan. The visit link is one line at the end.' 'cad_visit_plan' '' $false)
  (Step 'visit' 2 'Day 2' 'day' 2 0 0 0 'email' 'none' 'A guide that matches the main hesitation from the call.' 'cad_visit_guide' '' $false)
  (Step 'visit' 3 'Day 4' 'day' 4 0 0 0 'call' 'hard' 'The same guide calls, asks if questions came up, and offers two visit times. If nobody answers, send the existing home-visit text.' 'cad_visit_call' 'invite_visit_sms' $false)
  (Step 'visit' 4 'Day 6' 'day' 6 0 0 0 'email' 'soft' 'A note they can forward to their adult children, with the plan summary.' 'cad_visit_family' '' $false)
  (Step 'visit' 5 'Day 10' 'day' 10 0 0 0 'email' 'hard' 'Ask for a measuring visit of about an hour. They keep the measurements. Include the autonomy line.' 'cad_visit_ask' '' $false)
  (Step 'visit' 6 'Day 17' 'day' 17 0 0 0 'email' 'soft' 'What happens at a measuring visit: a short walkthrough so nothing about it is a surprise.' 'cad_visit_story' '' $false)
  (Step 'visit' 7 'Day 24' 'day' 24 0 0 0 'email' 'hard' 'The last direct ask. They are free to wait, and we will still be here.' 'cad_visit_last' '' $false)

  (Step 'nurture_new' 1 'Month 1' 'day' 0 0 0 0 'email' 'none' 'No ask. A guide, with the next Live Q&A date in the footer.' 'cad_nurture_new_1' '' $false)
  (Step 'nurture_new' 2 'Month 2' 'day' 30 0 0 0 'email' 'none' 'No ask. Another guide.' 'cad_nurture_new_2' '' $false)
  (Step 'nurture_new' 3 'Month 3' 'day' 60 0 0 0 'email' 'soft' 'A soft ask. About every third month this becomes a hard ask.' 'cad_nurture_new_3' '' $false)
  (Step 'nurture_qa' 1 'Month 1' 'day' 0 0 0 0 'email' 'none' 'No ask. A guide, with the next Live Q&A date in the footer.' 'cad_nurture_qa_1' '' $false)
  (Step 'nurture_qa' 2 'Month 2' 'day' 30 0 0 0 'email' 'soft' 'A soft ask toward the next Live Q&A or an Ask Anything 1:1.' 'cad_nurture_qa_2' '' $false)
  (Step 'nurture_qa' 3 'Month 3' 'day' 60 0 0 0 'email' 'hard' 'A hard ask for the next Live Q&A, with the Ask Anything 1:1 option.' 'cad_nurture_qa_3' '' $false)
  (Step 'nurture_visit' 1 'Month 1' 'day' 0 0 0 0 'email' 'soft' 'A soft ask for the visit, not for another Live Q&A.' 'cad_nurture_visit_1' '' $false)
  (Step 'nurture_visit' 2 'Month 2' 'day' 30 0 0 0 'email' 'hard' 'A hard ask for the measuring visit, with the autonomy line.' 'cad_nurture_visit_2' '' $false)

  (Step 'seasonal' 1 'Week before Thanksgiving' 'calendar' 0 0 11 19 'email' 'soft' 'A short checklist adult children can watch for on a holiday visit. Written to be forwarded.' 'cad_season_thanks' '' $false)
  (Step 'seasonal' 2 'First week of December' 'calendar' 0 0 12 3 'email' 'soft' 'The same forwarded checklist, adjusted for a Christmas visit.' 'cad_season_dec' '' $false)
  (Step 'seasonal' 3 'Second week of January' 'calendar' 0 0 1 8 'email' 'hard' 'Did the visit home raise anything? Invite them to a Live Q&A, with the Ask Anything 1:1 option.' 'cad_season_jan' '' $false)
  (Step 'seasonal' 4 'Later in January' 'calendar' 0 0 1 22 'email' 'soft' 'A follow-up guide after the holidays.' 'cad_season_jan_2' '' $false)
)

$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$messages | ConvertTo-Json -Depth 5 | Set-Content -Encoding utf8 (Join-Path $dir 'cadence-messages.json')
$sequences | ConvertTo-Json -Depth 5 | Set-Content -Encoding utf8 (Join-Path $dir 'cadence-sequences.json')
$steps | ConvertTo-Json -Depth 5 | Set-Content -Encoding utf8 (Join-Path $dir 'cadence-steps.json')
Write-Output ("messages=" + $messages.Count + " sequences=" + $sequences.Count + " steps=" + $steps.Count)
