# Dr. Alicia Scheduling System Blueprint

## Goal
Replace fragmented, manual booking with one automated onboarding + scheduling workflow.

## Target Workflow
1. Lead submits coaching inquiry form (main website).
2. Automation sends immediate response (email/SMS) with qualified booking options.
3. Lead books consultation via Calendly (30 min / $20).
4. Calendly event auto-creates Zoom link.
5. All events sync to one master calendar (Google), then to iPhone Calendar.
6. If lead converts to therapy/coaching, automation routes to Hello Alma onboarding + billing flow.

## Integrations
- **Calendly**: consultation booking + fee collection
- **Hello Alma**: therapy onboarding and ongoing client management
- **Zoom**: auto meeting links
- **Google Calendar**: master calendar source of truth
- **iPhone Calendar**: subscribed/synced output calendar
- **Stripe / PayPal policy**: pick one primary payment stack where possible

## Automation Rules
- New inquiry -> instant auto-response + booking link
- Missed booking after X hours -> reminder message
- Booked consult -> confirmation + intake form
- No-show -> reschedule workflow
- Converted client -> move to Hello Alma sequence

## Current Pain Points Solved
- Removes paid manual outreach for first response
- Prevents double bookings across disconnected calendars
- Reduces admin load and customer signup drop-off
- Gives one clear, professional intake path

## Implementation Order
1. Finalize master calendar account and ownership
2. Connect Calendly + Zoom + Google Calendar
3. Confirm iPhone Calendar sync behavior
4. Add form automation (webhook -> CRM/automation tool)
5. Connect Hello Alma routing for post-consult clients
6. Test full booking-to-onboarding journey end-to-end
