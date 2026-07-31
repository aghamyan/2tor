"use client";

import * as React from "react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  DataTable,
  DatePicker,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  EmptyState,
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldMessage,
  FieldSet,
  FieldLegend,
  Form,
  Input,
  Pagination,
  RadioGroup,
  RadioGroupItem,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "..";

const rows = [
  { id: "1", name: "Անի" },
  { id: "2", name: "Mariam" },
];

/** Mount this component in Storybook or any internal route to inspect every export. */
export function ComponentLibraryDemo() {
  const [page, setPage] = React.useState(1);
  const [toastOpen, setToastOpen] = React.useState(false);
  return (
    <TooltipProvider>
      <ToastProvider>
        <main className="mx-auto flex max-w-5xl flex-col gap-8 p-8">
          <Card>
            <CardHeader>
              <CardTitle>Components</CardTitle>
              <CardDescription>Հայերեն տեքստը ցուցադրվում է ընթեռնելի կերպով։</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-3">
              <Button>Continue</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="destructive">Destructive</Button>
              <Badge>Default</Badge>
              <Badge variant="success">Success</Badge>
              <Badge variant="warning">Warning</Badge>
              <Avatar>
                <AvatarFallback>Ա</AvatarFallback>
              </Avatar>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" aria-label="More information">
                    Info
                  </Button>
                </TooltipTrigger>
                <TooltipContent>More information</TooltipContent>
              </Tooltip>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Form controls</CardTitle>
            </CardHeader>
            <CardContent>
              <Form>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="demo-name">Name</FieldLabel>
                    <Input id="demo-name" name="name" />
                    <FieldDescription>Supporting context belongs here.</FieldDescription>
                    <FieldMessage id="demo-name-error">Validation message</FieldMessage>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="demo-notes">Notes</FieldLabel>
                    <Textarea id="demo-notes" name="notes" />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="demo-select">Choice</FieldLabel>
                    <Select>
                      <SelectTrigger id="demo-select">
                        <SelectValue placeholder="Choose" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectLabel>Options</SelectLabel>
                          <SelectItem value="one">One</SelectItem>
                          <SelectItem value="two">Two</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                  <FieldSet>
                    <FieldLegend>Preferences</FieldLegend>
                    <label className="flex items-center gap-2">
                      <Checkbox aria-label="Enable preference" />
                      Enabled
                    </label>
                    <label className="flex items-center gap-2">
                      <Switch aria-label="Toggle preference" />
                      Enabled
                    </label>
                    <RadioGroup aria-label="Select a preference">
                      <label className="flex items-center gap-2">
                        <RadioGroupItem value="first" />
                        First
                      </label>
                      <label className="flex items-center gap-2">
                        <RadioGroupItem value="second" />
                        Second
                      </label>
                    </RadioGroup>
                  </FieldSet>
                  <Field>
                    <FieldLabel htmlFor="demo-date">Date</FieldLabel>
                    <DatePicker
                      id="demo-date"
                      timeZone="Asia/Yerevan"
                      displayLabel={(date) => `Selected date: ${date}`}
                    />
                  </Field>
                </FieldGroup>
              </Form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Layers and feedback</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline">Open dialog</Button>
                </DialogTrigger>
                <DialogContent closeLabel="Close dialog">
                  <DialogHeader>
                    <DialogTitle>Dialog title</DialogTitle>
                    <DialogDescription>Dialog description.</DialogDescription>
                  </DialogHeader>
                </DialogContent>
              </Dialog>
              <Drawer>
                <DrawerTrigger asChild>
                  <Button variant="outline">Open drawer</Button>
                </DrawerTrigger>
                <DrawerContent closeLabel="Close drawer">
                  <DrawerHeader>
                    <DrawerTitle>Drawer title</DrawerTitle>
                    <DrawerDescription>Drawer description.</DrawerDescription>
                  </DrawerHeader>
                </DrawerContent>
              </Drawer>
              <Button onClick={() => setToastOpen(true)}>Show toast</Button>
              <Toast open={toastOpen} onOpenChange={setToastOpen}>
                <ToastTitle>Toast title</ToastTitle>
                <ToastDescription>Toast description.</ToastDescription>
                <ToastClose aria-label="Close toast" />
              </Toast>
              <Alert variant="warning">
                <AlertTitle>Alert title</AlertTitle>
                <AlertDescription>Alert description.</AlertDescription>
              </Alert>
              <Skeleton className="h-10 w-40" />
            </CardContent>
          </Card>

          <Tabs defaultValue="table">
            <TabsList>
              <TabsTrigger value="table">Table</TabsTrigger>
              <TabsTrigger value="empty">Empty state</TabsTrigger>
            </TabsList>
            <TabsContent value="table">
              <DataTable
                caption="Example people"
                rows={rows}
                getRowKey={(row) => row.id}
                columns={[{ id: "name", header: "Name", cell: (row) => row.name }]}
                page={page}
                pageSize={1}
                onPageChange={setPage}
                paginationLabels={{
                  previous: "Previous page",
                  next: "Next page",
                  page: (number) => `Page ${number}`,
                }}
              />
            </TabsContent>
            <TabsContent value="empty">
              <EmptyState>
                <p>No items</p>
                <Button variant="outline">Add item</Button>
              </EmptyState>
            </TabsContent>
          </Tabs>
          <Pagination
            aria-label="Standalone pagination"
            page={page}
            pageCount={2}
            onPageChange={setPage}
            labels={{
              previous: "Previous page",
              next: "Next page",
              page: (number) => `Page ${number}`,
            }}
          />
        </main>
        <ToastViewport />
      </ToastProvider>
    </TooltipProvider>
  );
}
