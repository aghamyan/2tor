-- Custom SQL migration file, put your code below! --

-- audit_events is append-only (spec §12.5: "Audit logs are append-only to application users and
-- protected from normal deletion"). A schema-level constraint can't stop UPDATE/DELETE, so this
-- trigger rejects both unconditionally, regardless of which DB role issues them.
CREATE OR REPLACE FUNCTION audit_events_block_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_events is append-only: % is not permitted', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_events_no_update
  BEFORE UPDATE ON "audit_events"
  FOR EACH ROW
  EXECUTE FUNCTION audit_events_block_mutation();

CREATE TRIGGER audit_events_no_delete
  BEFORE DELETE ON "audit_events"
  FOR EACH ROW
  EXECUTE FUNCTION audit_events_block_mutation();
