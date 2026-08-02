-- Account deletion now runs through the authenticated delete-account Edge
-- Function. Remove the old SECURITY DEFINER RPC from the public API.
drop function if exists public.delete_user();
