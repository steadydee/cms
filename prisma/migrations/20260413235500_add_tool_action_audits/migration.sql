CREATE TABLE "tool_action_audits" (
  "id" TEXT NOT NULL,
  "app" TEXT NOT NULL DEFAULT 'partners',
  "tool_name" TEXT NOT NULL,
  "classification" TEXT NOT NULL,
  "actor_type" TEXT NOT NULL,
  "actor_id" TEXT,
  "actor_label" TEXT,
  "credential_id" TEXT,
  "request_source" TEXT,
  "property_id" TEXT,
  "target_entity_type" TEXT,
  "target_entity_id" TEXT,
  "status" TEXT NOT NULL,
  "error_code" TEXT,
  "correlation_id" TEXT,
  "input_summary" TEXT,
  "output_summary" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "tool_action_audits_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "tool_action_audits_tool_name_created_at_idx"
ON "tool_action_audits"("tool_name", "created_at");

CREATE INDEX "tool_action_audits_actor_type_created_at_idx"
ON "tool_action_audits"("actor_type", "created_at");

CREATE INDEX "tool_action_audits_property_id_created_at_idx"
ON "tool_action_audits"("property_id", "created_at");
