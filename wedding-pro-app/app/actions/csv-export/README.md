# CSV Export Functionality

This module provides functionality for exporting data from the Wedding Pro application to CSV format.

## Current Implementation

The current implementation includes:

- UI components for CSV export in the Admin dashboard
- Data scope selection (Jobs, Users, Venues)
- Date range filtering
- Field selection for customizing the CSV output
- Basic server-side action structure for CSV generation

## Usage

The CSV export functionality is accessible from the Admin dashboard. Administrators can:

1. Select the type of data to export (Jobs, Users, Venues)
2. Choose a date range filter (All Time, Last Month, Last Quarter, Last Year)
3. Select specific fields to include in the export
4. For Jobs data, optionally include job assignments (subtasks)
5. Click the "Export to CSV" button to generate and download the CSV file

## Technical Details

### UI Components

- `CSVExport` component in `components/admin/csv-export.tsx`
- Integrated into the Admin dashboard in `app/dashboard/admin/page.tsx`

### Server Actions

- Main export functionality in `app/actions/csv-export/index.ts`
- Uses Supabase client to fetch data
- Implements permission checks to ensure only administrators can export data

## Future Enhancements

The following enhancements are planned for future implementation:

1. **Complete CSV Generation Logic**:
   - Implement actual data fetching and CSV formatting for each data type
   - Add proper field mapping and data transformation

2. **Advanced Filtering**:
   - Custom date range selection
   - Status-based filtering (e.g., only completed jobs)
   - User role filtering

3. **Export Format Options**:
   - Support for additional export formats (Excel, JSON)
   - Customizable CSV delimiter options

4. **Performance Optimizations**:
   - Streaming large datasets
   - Background processing for very large exports
   - Email notification when large exports are ready

5. **Export History**:
   - Track export history
   - Allow re-downloading of previous exports

## Security Considerations

- Only administrators can access the CSV export functionality
- Exported data is filtered based on organization boundaries
- Sensitive data is appropriately handled according to privacy requirements