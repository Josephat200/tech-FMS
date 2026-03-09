INSERT INTO tech_rica.roles(role_id, role_name, role_description, is_system_role)
VALUES (gen_random_uuid(), 'AUDITOR', 'Financial auditor role', TRUE)
ON CONFLICT (role_name) DO NOTHING;

INSERT INTO tech_rica.roles(role_id, role_name, role_description, is_system_role)
VALUES (gen_random_uuid(), 'DEPARTMENT_MANAGER', 'Department manager role', TRUE)
ON CONFLICT (role_name) DO NOTHING;
