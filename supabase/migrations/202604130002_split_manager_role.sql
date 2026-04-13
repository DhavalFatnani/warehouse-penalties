-- Split legacy manager role into store manager and central team member.

alter type public.user_role add value if not exists 'store_manager';
alter type public.user_role add value if not exists 'central_team_member';

