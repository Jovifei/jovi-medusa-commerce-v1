import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260830105444 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "jovi_entitlement" add column if not exists "payment_evidence_sha256" text not null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "jovi_entitlement" drop column if exists "payment_evidence_sha256";`);
  }

}
