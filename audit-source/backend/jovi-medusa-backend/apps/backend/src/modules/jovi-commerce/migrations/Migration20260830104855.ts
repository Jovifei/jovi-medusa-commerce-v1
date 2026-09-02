import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260830104855 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "jovi_asset" add column if not exists "provenance" jsonb not null;`);

    this.addSql(`alter table if exists "jovi_delivery_receipt" add column if not exists "provenance" jsonb not null;`);

    this.addSql(`alter table if exists "jovi_entitlement" add column if not exists "provenance" jsonb not null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "jovi_asset" drop column if exists "provenance";`);

    this.addSql(`alter table if exists "jovi_delivery_receipt" drop column if exists "provenance";`);

    this.addSql(`alter table if exists "jovi_entitlement" drop column if exists "provenance";`);
  }

}
