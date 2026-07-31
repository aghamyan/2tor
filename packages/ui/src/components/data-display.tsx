import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../lib/utils";
import { Button } from "./button";

const Table = React.forwardRef<HTMLTableElement, React.ComponentPropsWithoutRef<"table">>(
  ({ className, ...props }, ref) => (
    <div className="relative w-full overflow-auto">
      <table ref={ref} className={cn("w-full caption-bottom text-sm", className)} {...props} />
    </div>
  ),
);
Table.displayName = "Table";
const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.ComponentPropsWithoutRef<"thead">
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn("[&_tr]:border-b", className)} {...props} />
));
TableHeader.displayName = "TableHeader";
const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.ComponentPropsWithoutRef<"tbody">
>(({ className, ...props }, ref) => (
  <tbody ref={ref} className={cn("[&_tr:last-child]:border-0", className)} {...props} />
));
TableBody.displayName = "TableBody";
const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.ComponentPropsWithoutRef<"tfoot">
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn("border-t bg-muted/50 font-medium [&>tr]:last:border-b-0", className)}
    {...props}
  />
));
TableFooter.displayName = "TableFooter";
const TableRow = React.forwardRef<HTMLTableRowElement, React.ComponentPropsWithoutRef<"tr">>(
  ({ className, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn(
        "border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted motion-reduce:transition-none",
        className,
      )}
      {...props}
    />
  ),
);
TableRow.displayName = "TableRow";
const TableHead = React.forwardRef<React.ElementRef<"th">, React.ComponentPropsWithoutRef<"th">>(
  ({ className, ...props }, ref) => (
    <th
      ref={ref}
      className={cn(
        "h-11 px-3 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0",
        className,
      )}
      {...props}
    />
  ),
);
TableHead.displayName = "TableHead";
const TableCell = React.forwardRef<React.ElementRef<"td">, React.ComponentPropsWithoutRef<"td">>(
  ({ className, ...props }, ref) => (
    <td
      ref={ref}
      className={cn("p-3 align-middle [&:has([role=checkbox])]:pr-0", className)}
      {...props}
    />
  ),
);
TableCell.displayName = "TableCell";
const TableCaption = React.forwardRef<
  React.ElementRef<"caption">,
  React.ComponentPropsWithoutRef<"caption">
>(({ className, ...props }, ref) => (
  <caption ref={ref} className={cn("mt-4 text-sm text-muted-foreground", className)} {...props} />
));
TableCaption.displayName = "TableCaption";

export interface PaginationLabels {
  previous: string;
  next: string;
  page: (page: number) => string;
}
interface PaginationProps extends Omit<
  React.ComponentPropsWithoutRef<"nav">,
  "onChange" | "aria-label"
> {
  "aria-label": string;
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  labels: PaginationLabels;
}
function Pagination({
  page,
  pageCount,
  onPageChange,
  labels,
  className,
  "aria-label": ariaLabel,
  ...props
}: PaginationProps) {
  const pages = Array.from({ length: pageCount }, (_, index) => index + 1);
  return (
    <nav
      aria-label={ariaLabel}
      className={cn("flex items-center justify-end gap-1", className)}
      {...props}
    >
      <Button
        variant="outline"
        size="icon"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        aria-label={labels.previous}
      >
        <ChevronLeft aria-hidden="true" />
      </Button>
      {pages.map((item) => (
        <Button
          key={item}
          variant={item === page ? "default" : "ghost"}
          size="icon"
          onClick={() => onPageChange(item)}
          aria-current={item === page ? "page" : undefined}
          aria-label={labels.page(item)}
        >
          {item}
        </Button>
      ))}
      <Button
        variant="outline"
        size="icon"
        disabled={page >= pageCount}
        onClick={() => onPageChange(page + 1)}
        aria-label={labels.next}
      >
        <ChevronRight aria-hidden="true" />
      </Button>
    </nav>
  );
}

export interface DataTableColumn<T> {
  id: string;
  header: React.ReactNode;
  cell: (row: T, rowIndex: number) => React.ReactNode;
  className?: string;
}
interface DataTableProps<T> {
  /** A localized text alternative used by the table caption and pagination nav. */
  caption: string;
  columns: readonly DataTableColumn<T>[];
  rows: readonly T[];
  getRowKey: (row: T, index: number) => React.Key;
  page?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  paginationLabels?: PaginationLabels;
  empty?: React.ReactNode;
}
function DataTable<T>({
  caption,
  columns,
  rows,
  getRowKey,
  page = 1,
  pageSize,
  onPageChange,
  paginationLabels,
  empty,
}: DataTableProps<T>) {
  const pageCount = pageSize ? Math.max(1, Math.ceil(rows.length / pageSize)) : 1;
  const visibleRows = pageSize ? rows.slice((page - 1) * pageSize, page * pageSize) : rows;
  return (
    <div className="flex flex-col gap-4">
      <Table>
        <TableCaption className="sr-only">{caption}</TableCaption>
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
              <TableHead key={column.id} className={column.className}>
                {column.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {visibleRows.length > 0 ? (
            visibleRows.map((row, index) => (
              <TableRow key={getRowKey(row, index)}>
                {columns.map((column) => (
                  <TableCell key={column.id} className={column.className}>
                    {column.cell(row, index)}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="h-24 text-center text-muted-foreground"
              >
                {empty}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      {pageSize && onPageChange && paginationLabels ? (
        <Pagination
          aria-label={String(caption)}
          page={Math.min(page, pageCount)}
          pageCount={pageCount}
          onPageChange={onPageChange}
          labels={paginationLabels}
        />
      ) : null}
    </div>
  );
}

export {
  DataTable,
  Pagination,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
};
