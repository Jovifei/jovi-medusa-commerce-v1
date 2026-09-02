import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260831150000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table if exists "jovi_run" add column if not exists "payment_snapshot_sha256" text not null default '0000000000000000000000000000000000000000000000000000000000000000';`)
    this.addSql(`alter table if exists "jovi_evidence" add column if not exists "evidence_key" text not null default '';`)
    this.addSql(`alter table if exists "jovi_evidence" add column if not exists "payment_snapshot_sha256" text null;`)
    this.addSql(`create unique index if not exists "IDX_jovi_run_order_id_unique" on "jovi_run" ("order_id") where deleted_at is null;`)
    this.addSql(`create unique index if not exists "IDX_jovi_run_payment_collection_id_unique" on "jovi_run" ("payment_collection_id") where deleted_at is null;`)
    this.addSql(`create unique index if not exists "IDX_jovi_evidence_evidence_key_unique" on "jovi_evidence" ("evidence_key") where deleted_at is null;`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "IDX_jovi_run_order_id_unique";`)
    this.addSql(`drop index if exists "IDX_jovi_run_payment_collection_id_unique";`)
    this.addSql(`drop index if exists "IDX_jovi_evidence_evidence_key_unique";`)
    this.addSql(`alter table if exists "jovi_run" drop column if exists "payment_snapshot_sha256";`)
    this.addSql(`alter table if exists "jovi_evidence" drop column if exists "evidence_key";`)
    this.addSql(`alter table if exists "jovi_evidence" drop column if exists "payment_snapshot_sha256";`)
  }
}
