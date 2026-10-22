import {
    char,
    customType,
    date,
    decimal,
    index,
    int,
    mediumtext,
    mysqlTable,
    smallint,
    text,
    timestamp,
    tinyint,
    uniqueIndex,
    varchar,
} from "drizzle-orm/mysql-core";

const mediumblob = customType<{ data: Buffer }>({
    dataType: () => "mediumblob",
});

export const books = mysqlTable(
    "books",
    {
        id: int("id", { unsigned: true }).primaryKey().autoincrement(),
        slug: varchar("slug", { length: 191 }).notNull(),
        title: varchar("title", { length: 255 }).notNull(),
        author: varchar("author", { length: 255 }).notNull(),
        synopsis: text("synopsis"),
        review: mediumtext("review"),
        rating: tinyint("rating", { unsigned: true }).notNull().default(0),
        pages: smallint("pages", { unsigned: true }),
        widthPx: smallint("width_px", { unsigned: true }),
        heightPx: smallint("height_px", { unsigned: true }),
        spineColor: char("spine_color", { length: 7 })
            .notNull()
            .default("#7ab8e0"),
        spineTextColor: char("spine_text_color", { length: 7 })
            .notNull()
            .default("#fdfaf4"),
        coverImage: mediumblob("cover_image"),
        coverMime: varchar("cover_mime", { length: 64 }),
        spineImage: mediumblob("spine_image"),
        spineMime: varchar("spine_mime", { length: 64 }),
        spineRatio: decimal("spine_ratio", { precision: 5, scale: 3 }),
        dateRead: date("date_read", { mode: "string" }),
        createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
        updatedAt: timestamp("updated_at", { mode: "string" })
            .defaultNow()
            .onUpdateNow(),
        categoryId: int("category_id", { unsigned: true }),
        position: int("position", { unsigned: true }).notNull().default(0),
    },
    (t) => [
        uniqueIndex("uq_books_slug").on(t.slug),
        index("idx_books_author").on(t.author),
        index("idx_books_rating").on(t.rating),
        index("idx_books_date_read").on(t.dateRead),
        index("idx_books_category").on(t.categoryId, t.position),
    ],
);

export const categories = mysqlTable("categories", {
    id: int("id", { unsigned: true }).primaryKey().autoincrement(),
    name: varchar("name", { length: 191 }).notNull(),
    position: int("position", { unsigned: true }).notNull().default(0),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
});

export const images = mysqlTable("images", {
    id: int("id", { unsigned: true }).primaryKey().autoincrement(),
    mime: varchar("mime", { length: 64 }).notNull(),
    data: mediumblob("data").notNull(),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
});
