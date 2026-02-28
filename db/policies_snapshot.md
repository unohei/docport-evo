| tablename       | policyname                          | cmd    | using_expression | with_check_expression                                |
| --------------- | ----------------------------------- | ------ | ---------------- | ---------------------------------------------------- |
| document_events | document_events_insert_own_hospital | INSERT | null             | ((actor_user_id = auth.uid()) AND (EXISTS ( SELECT 1 |

FROM profiles p
WHERE ((p.id = auth.uid()) AND (p.hospital_id = document_events.hospital_id)))) AND (EXISTS ( SELECT 1
FROM documents d
WHERE ((d.id = document_events.document_id) AND (d.to_hospital_id = document_events.hospital_id))))) |
| document_events | document_events_select_own_hospital | SELECT | (EXISTS ( SELECT 1
FROM profiles p
WHERE ((p.id = auth.uid()) AND (p.hospital_id = document_events.hospital_id)))) | null |
| document_logs | document_logs_insert_own_hospital | INSERT | null | ((changed_by = auth.uid()) AND (EXISTS ( SELECT 1
FROM profiles p
WHERE ((p.id = auth.uid()) AND (p.hospital_id = document_logs.hospital_id)))) AND (EXISTS ( SELECT 1
FROM documents d
WHERE ((d.id = document_logs.document_id) AND (d.to_hospital_id = document_logs.hospital_id))))) |
| document_logs | document_logs_select_own_hospital | SELECT | (EXISTS ( SELECT 1
FROM profiles p
WHERE ((p.id = auth.uid()) AND (p.hospital_id = document_logs.hospital_id)))) | null |
| documents | documents_insert_from_own_hospital | INSERT | null | (from_hospital_id = ( SELECT profiles.hospital_id
FROM profiles
WHERE (profiles.id = auth.uid()))) |
| documents | documents_select_own_hospital | SELECT | ((from_hospital_id = ( SELECT profiles.hospital_id
FROM profiles
WHERE (profiles.id = auth.uid()))) OR (to_hospital_id = ( SELECT profiles.hospital_id
FROM profiles
WHERE (profiles.id = auth.uid())))) | null |
| documents | documents_update_cancel_by_sender | UPDATE | (from_hospital_id = ( SELECT profiles.hospital_id
FROM profiles
WHERE (profiles.id = auth.uid()))) | (from_hospital_id = ( SELECT profiles.hospital_id
FROM profiles
WHERE (profiles.id = auth.uid()))) |
| documents | documents_update_own_hospital | UPDATE | (EXISTS ( SELECT 1
FROM profiles p
WHERE ((p.id = auth.uid()) AND (p.hospital_id = documents.to_hospital_id)))) | (EXISTS ( SELECT 1
FROM profiles p
WHERE ((p.id = auth.uid()) AND (p.hospital_id = documents.to_hospital_id)))) |
| profiles | profiles_select_own | SELECT | (auth.uid() = id) | null |
| profiles | profiles_select_same_hospital | SELECT | ((id = auth.uid()) OR (hospital_id = ( SELECT p2.hospital_id
FROM profiles p2
WHERE (p2.id = auth.uid())
LIMIT 1))) | null |
