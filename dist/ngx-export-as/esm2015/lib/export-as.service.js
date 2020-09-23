import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';
// import * as htmlDocx from 'html-docx-js/dist/html-docx';
import html2pdf from 'html2pdf.js';
import * as i0 from "@angular/core";
window['html2canvas'] = html2canvas;
export class ExportAsService {
    constructor() { }
    /**
     * Main base64 get method, it will return the file as base64 string
     * @param config your config
     */
    get(config) {
        // structure method name dynamically by type
        const func = 'get' + config.type.toUpperCase();
        // if type supported execute and return
        if (this[func]) {
            return this[func](config);
        }
        // throw error for unsupported formats
        return Observable.create((observer) => { observer.error('Export type is not supported.'); });
    }
    /**
     * Save exported file in old javascript way
     * @param config your custom config
     * @param fileName Name of the file to be saved as
     */
    save(config, fileName) {
        // set download
        config.download = true;
        // get file name with type
        config.fileName = fileName + '.' + config.type;
        return this.get(config);
    }
    /**
     * Converts content string to blob object
     * @param content string to be converted
     */
    contentToBlob(content) {
        return Observable.create((observer) => {
            // get content string and extract mime type
            const arr = content.split(','), mime = arr[0].match(/:(.*?);/)[1], bstr = atob(arr[1]);
            let n = bstr.length;
            const u8arr = new Uint8Array(n);
            while (n--) {
                u8arr[n] = bstr.charCodeAt(n);
            }
            observer.next(new Blob([u8arr], { type: mime }));
            observer.complete();
        });
    }
    /**
     * Removes base64 file type from a string like "data:text/csv;base64,"
     * @param fileContent the base64 string to remove the type from
     */
    removeFileTypeFromBase64(fileContent) {
        const re = /^data:[^]*;base64,/g;
        const newContent = re[Symbol.replace](fileContent, '');
        return newContent;
    }
    /**
     * Structure the base64 file content with the file type string
     * @param fileContent file content
     * @param fileMime file mime type "text/csv"
     */
    addFileTypeToBase64(fileContent, fileMime) {
        return `data:${fileMime};base64,${fileContent}`;
    }
    /**
     * create downloadable file from dataURL
     * @param fileName downloadable file name
     * @param dataURL file content as dataURL
     */
    downloadFromDataURL(fileName, dataURL) {
        // create blob
        this.contentToBlob(dataURL).subscribe(blob => {
            // download the blob
            this.downloadFromBlob(blob, fileName);
        });
    }
    /**
     * Downloads the blob object as a file
     * @param blob file object as blob
     * @param fileName downloadable file name
     */
    downloadFromBlob(blob, fileName) {
        // get object url
        const url = window.URL.createObjectURL(blob);
        // check for microsoft internet explorer
        if (window.navigator && window.navigator.msSaveOrOpenBlob) {
            // use IE download or open if the user using IE
            window.navigator.msSaveOrOpenBlob(blob, fileName);
        }
        else {
            // if not using IE then create link element
            const element = document.createElement('a');
            // set download attr with file name
            element.setAttribute('download', fileName);
            // set the element as hidden
            element.style.display = 'none';
            // append the body
            document.body.appendChild(element);
            // set href attr
            element.href = url;
            // click on it to start downloading
            element.click();
            // remove the link from the dom
            document.body.removeChild(element);
        }
    }
    getPDF(config) {
        return Observable.create((observer) => {
            if (!config.options) {
                config.options = {};
            }
            config.options.filename = config.fileName;
            const element = document.getElementById(config.elementIdOrContent);
            const pdf = html2pdf().set(config.options).from(element ? element : config.elementIdOrContent);
            const download = config.download;
            const pdfCallbackFn = config.options.pdfCallbackFn;
            if (download) {
                if (pdfCallbackFn) {
                    this.applyPdfCallbackFn(pdf, pdfCallbackFn).save();
                }
                else {
                    pdf.save();
                }
                observer.next();
                observer.complete();
            }
            else {
                if (pdfCallbackFn) {
                    this.applyPdfCallbackFn(pdf, pdfCallbackFn).outputPdf('datauristring').then(data => {
                        observer.next(data);
                        observer.complete();
                    });
                }
                else {
                    pdf.outputPdf('datauristring').then(data => {
                        observer.next(data);
                        observer.complete();
                    });
                }
            }
        });
    }
    applyPdfCallbackFn(pdf, pdfCallbackFn) {
        return pdf.toPdf().get('pdf').then((pdfRef) => {
            pdfCallbackFn(pdfRef);
        });
    }
    getPNG(config) {
        return Observable.create((observer) => {
            const element = document.getElementById(config.elementIdOrContent);
            html2canvas(element, config.options).then((canvas) => {
                const imgData = canvas.toDataURL('image/PNG');
                if (config.type === 'png' && config.download) {
                    this.downloadFromDataURL(config.fileName, imgData);
                    observer.next();
                }
                else {
                    observer.next(imgData);
                }
                observer.complete();
            }, err => {
                observer.error(err);
            });
        });
    }
    getCSV(config) {
        return Observable.create((observer) => {
            const element = document.getElementById(config.elementIdOrContent);
            const csv = [];
            const rows = element.querySelectorAll('table tr');
            for (let index = 0; index < rows.length; index++) {
                const rowElement = rows[index];
                const row = [];
                const cols = rowElement.querySelectorAll('td, th');
                for (let colIndex = 0; colIndex < cols.length; colIndex++) {
                    const col = cols[colIndex];
                    row.push(col.innerText);
                }
                csv.push(row.join(','));
            }
            const csvContent = 'data:text/csv;base64,' + this.btoa(csv.join('\n'));
            if (config.download) {
                this.downloadFromDataURL(config.fileName, csvContent);
                observer.next();
            }
            else {
                observer.next(csvContent);
            }
            observer.complete();
        });
    }
    getTXT(config) {
        const nameFrags = config.fileName.split('.');
        config.fileName = `${nameFrags[0]}.txt`;
        return this.getCSV(config);
    }
    getXLS(config) {
        return Observable.create((observer) => {
            const element = document.getElementById(config.elementIdOrContent);
            const ws3 = XLSX.utils.table_to_sheet(element, config.options);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws3, config.fileName);
            const out = XLSX.write(wb, { type: 'base64' });
            const xlsContent = 'data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,' + out;
            if (config.download) {
                this.downloadFromDataURL(config.fileName, xlsContent);
                observer.next();
            }
            else {
                observer.next(xlsContent);
            }
            observer.complete();
        });
    }
    getXLSX(config) {
        return this.getXLS(config);
    }
    // private getDOCX(config: ExportAsConfig): Observable<string | null> {
    //   return Observable.create((observer) => {
    //     const contentDocument: string = document.getElementById(config.elementIdOrContent).outerHTML;
    //     const content = '<!DOCTYPE html>' + contentDocument;
    //     const converted = htmlDocx.asBlob(content, config.options);
    //     if (config.download) {
    //       this.downloadFromBlob(converted, config.fileName);
    //       observer.next();
    //       observer.complete();
    //     } else {
    //       const reader = new FileReader();
    //       reader.onloadend = () => {
    //         const base64data = reader.result;
    //         observer.next(base64data);
    //         observer.complete();
    //       };
    //       reader.readAsDataURL(converted);
    //     }
    //   });
    // }
    // private getDOC(config: ExportAsConfig): Observable<string | null> {
    //   return this.getDOCX(config);
    // }
    getJSON(config) {
        return Observable.create((observer) => {
            const data = []; // first row needs to be headers
            const headers = [];
            const table = document.getElementById(config.elementIdOrContent);
            for (let index = 0; index < table.rows[0].cells.length; index++) {
                headers[index] = table.rows[0].cells[index].innerHTML.toLowerCase().replace(/ /gi, '');
            }
            // go through cells
            for (let i = 1; i < table.rows.length; i++) {
                const tableRow = table.rows[i];
                const rowData = {};
                for (let j = 0; j < tableRow.cells.length; j++) {
                    rowData[headers[j]] = tableRow.cells[j].innerHTML;
                }
                data.push(rowData);
            }
            const jsonString = JSON.stringify(data);
            const jsonBase64 = this.btoa(jsonString);
            const dataStr = 'data:text/json;base64,' + jsonBase64;
            if (config.download) {
                this.downloadFromDataURL(config.fileName, dataStr);
                observer.next();
            }
            else {
                observer.next(data);
            }
            observer.complete();
        });
    }
    getXML(config) {
        return Observable.create((observer) => {
            let xml = '<?xml version="1.0" encoding="UTF-8"?><Root><Classes>';
            const tritem = document.getElementById(config.elementIdOrContent).getElementsByTagName('tr');
            for (let i = 0; i < tritem.length; i++) {
                const celldata = tritem[i];
                if (celldata.cells.length > 0) {
                    xml += '<Class name="' + celldata.cells[0].textContent + '">\n';
                    for (let m = 1; m < celldata.cells.length; ++m) {
                        xml += '\t<data>' + celldata.cells[m].textContent + '</data>\n';
                    }
                    xml += '</Class>\n';
                }
            }
            xml += '</Classes></Root>';
            const base64 = 'data:text/xml;base64,' + this.btoa(xml);
            if (config.download) {
                this.downloadFromDataURL(config.fileName, base64);
                observer.next();
            }
            else {
                observer.next(base64);
            }
            observer.complete();
        });
    }
    btoa(content) {
        return btoa(unescape(encodeURIComponent(content)));
    }
}
ExportAsService.ɵfac = function ExportAsService_Factory(t) { return new (t || ExportAsService)(); };
ExportAsService.ɵprov = i0.ɵɵdefineInjectable({ token: ExportAsService, factory: ExportAsService.ɵfac });
/*@__PURE__*/ (function () { i0.ɵsetClassMetadata(ExportAsService, [{
        type: Injectable
    }], function () { return []; }, null); })();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXhwb3J0LWFzLnNlcnZpY2UuanMiLCJzb3VyY2VSb290Ijoibmc6Ly9uZ3gtZXhwb3J0LWFzLyIsInNvdXJjZXMiOlsibGliL2V4cG9ydC1hcy5zZXJ2aWNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxlQUFlLENBQUM7QUFDM0MsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLE1BQU0sQ0FBQztBQUlsQyxPQUFPLFdBQVcsTUFBTSxhQUFhLENBQUM7QUFDdEMsT0FBTyxLQUFLLElBQUksTUFBTSxNQUFNLENBQUM7QUFDN0IsMkRBQTJEO0FBQzNELE9BQU8sUUFBUSxNQUFNLGFBQWEsQ0FBQzs7QUFFbkMsTUFBTSxDQUFDLGFBQWEsQ0FBQyxHQUFHLFdBQVcsQ0FBQztBQUdwQyxNQUFNLE9BQU8sZUFBZTtJQUUxQixnQkFBZ0IsQ0FBQztJQUVqQjs7O09BR0c7SUFDSCxHQUFHLENBQUMsTUFBc0I7UUFDeEIsNENBQTRDO1FBQzVDLE1BQU0sSUFBSSxHQUFHLEtBQUssR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDO1FBQy9DLHVDQUF1QztRQUN2QyxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRTtZQUNkLE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1NBQzNCO1FBRUQsc0NBQXNDO1FBQ3RDLE9BQU8sVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDLFFBQVEsRUFBRSxFQUFFLEdBQUcsUUFBUSxDQUFDLEtBQUssQ0FBQywrQkFBK0IsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDL0YsQ0FBQztJQUVEOzs7O09BSUc7SUFDSCxJQUFJLENBQUMsTUFBc0IsRUFBRSxRQUFnQjtRQUMzQyxlQUFlO1FBQ2YsTUFBTSxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUM7UUFDdkIsMEJBQTBCO1FBQzFCLE1BQU0sQ0FBQyxRQUFRLEdBQUcsUUFB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aEUsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLFFBQVEsQ0FBQyxLQUFLLENBQUMsTUFBTSxFQUFFLEVBQUUsQ0FBQyxFQUFFO3dCQUM5QyxHQUFHLElBQUksVUFBVSxHQUFHLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxHQUFHLFdBQVcsQ0FBQztxQkFDakU7b0JBQ0QsR0FBRyxJQUFJLFlBQVksQ0FBQztpQkFDckI7YUFDRjtZQUNELEdBQUcsSUFBSSxtQkFBbUIsQ0FBQztZQUMzQixNQUFNLE1BQU0sR0FBRyx1QkFBdUIsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBQ3hELElBQUksTUFBTSxDQUFDLFFBQVEsRUFBRTtnQkFDbkIsSUFBSSxDQUFDLG1CQUFtQixDQUFDLE1BQU0sQ0FBQyxRQUFRLEVBQUUsTUFBTSxDQUFDLENBQUM7Z0JBQ2xELFFBQVEsQ0FBQyxJQUFJLEVBQUUsQ0FBQzthQUNqQjtpQkFBTTtnQkFDTCxRQUFRLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO2FBQ3ZCO1lBQ0QsUUFBUSxDQUFDLFFBQVEsRUFBRSxDQUFDO1FBQ3RCLENBQUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVPLElBQUksQ0FBQyxPQUFlO1FBQzFCLE9BQU8sSUFBSSxDQUFDLFFBQVEsQ0FBQyxrQkFBa0IsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDckQsQ0FBQzs7OEVBdFRVLGVBQWU7dURBQWYsZUFBZSxXQUFmLGVBQWU7a0RBQWYsZUFBZTtjQUQzQixVQUFVIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgSW5qZWN0YWJsZSB9IGZyb20gJ0Bhbmd1bGFyL2NvcmUnO1xyXG5pbXBvcnQgeyBPYnNlcnZhYmxlIH0gZnJvbSAncnhqcyc7XHJcblxyXG5pbXBvcnQgeyBFeHBvcnRBc0NvbmZpZyB9IGZyb20gJy4vZXhwb3J0LWFzLWNvbmZpZy5tb2RlbCc7XHJcblxyXG5pbXBvcnQgaHRtbDJjYW52YXMgZnJvbSAnaHRtbDJjYW52YXMnO1xyXG5pbXBvcnQgKiBhcyBYTFNYIGZyb20gJ3hsc3gnO1xyXG4vLyBpbXBvcnQgKiBhcyBodG1sRG9jeCBmcm9tICdodG1sLWRvY3gtanMvZGlzdC9odG1sLWRvY3gnO1xyXG5pbXBvcnQgaHRtbDJwZGYgZnJvbSAnaHRtbDJwZGYuanMnO1xyXG5cclxud2luZG93WydodG1sMmNhbnZhcyddID0gaHRtbDJjYW52YXM7XHJcblxyXG5ASW5qZWN0YWJsZSgpXHJcbmV4cG9ydCBjbGFzcyBFeHBvcnRBc1NlcnZpY2Uge1xyXG5cclxuICBjb25zdHJ1Y3RvcigpIHsgfVxyXG5cclxuICAvKipcclxuICAgKiBNYWluIGJhc2U2NCBnZXQgbWV0aG9kLCBpdCB3aWxsIHJldHVybiB0aGUgZmlsZSBhcyBiYXNlNjQgc3RyaW5nXHJcbiAgICogQHBhcmFtIGNvbmZpZyB5b3VyIGNvbmZpZ1xyXG4gICAqL1xyXG4gIGdldChjb25maWc6IEV4cG9ydEFzQ29uZmlnKTogT2JzZXJ2YWJsZTxzdHJpbmcgfCBudWxsPiB7XHJcbiAgICAvLyBzdHJ1Y3R1cmUgbWV0aG9kIG5hbWUgZHluYW1pY2FsbHkgYnkgdHlwZVxyXG4gICAgY29uc3QgZnVuYyA9ICdnZXQnICsgY29uZmlnLnR5cGUudG9VcHBlckNhc2UoKTtcclxuICAgIC8vIGlmIHR5cGUgc3VwcG9ydGVkIGV4ZWN1dGUgYW5kIHJldHVyblxyXG4gICAgaWYgKHRoaXNbZnVuY10pIHtcclxuICAgICAgcmV0dXJuIHRoaXNbZnVuY10oY29uZmlnKTtcclxuICAgIH1cclxuXHJcbiAgICAvLyB0aHJvdyBlcnJvciBmb3IgdW5zdXBwb3J0ZWQgZm9ybWF0c1xyXG4gICAgcmV0dXJuIE9ic2VydmFibGUuY3JlYXRlKChvYnNlcnZlcikgPT4geyBvYnNlcnZlci5lcnJvcignRXhwb3J0IHR5cGUgaXMgbm90IHN1cHBvcnRlZC4nKTsgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBTYXZlIGV4cG9ydGVkIGZpbGUgaW4gb2xkIGphdmFzY3JpcHQgd2F5XHJcbiAgICogQHBhcmFtIGNvbmZpZyB5b3VyIGN1c3RvbSBjb25maWdcclxuICAgKiBAcGFyYW0gZmlsZU5hbWUgTmFtZSBvZiB0aGUgZmlsZSB0byBiZSBzYXZlZCBhc1xyXG4gICAqL1xyXG4gIHNhdmUoY29uZmlnOiBFeHBvcnRBc0NvbmZpZywgZmlsZU5hbWU6IHN0cmluZyk6IE9ic2VydmFibGU8c3RyaW5nIHwgbnVsbD4ge1xyXG4gICAgLy8gc2V0IGRvd25sb2FkXHJcbiAgICBjb25maWcuZG93bmxvYWQgPSB0cnVlO1xyXG4gICAgLy8gZ2V0IGZpbGUgbmFtZSB3aXRoIHR5cGVcclxuICAgIGNvbmZpZy5maWxlTmFtZSA9IGZpbGVOYW1lICsgJy4nICsgY29uZmlnLnR5cGU7XHJcbiAgICByZXR1cm4gdGhpcy5nZXQoY29uZmlnKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENvbnZlcnRzIGNvbnRlbnQgc3RyaW5nIHRvIGJsb2Igb2JqZWN0XHJcbiAgICogQHBhcmFtIGNvbnRlbnQgc3RyaW5nIHRvIGJlIGNvbnZlcnRlZFxyXG4gICAqL1xyXG4gIGNvbnRlbnRUb0Jsb2IoY29udGVudDogc3RyaW5nKTogT2JzZXJ2YWJsZTxCbG9iPiB7XHJcbiAgICByZXR1cm4gT2JzZXJ2YWJsZS5jcmVhdGUoKG9ic2VydmVyKSA9PiB7XHJcbiAgICAgIC8vIGdldCBjb250ZW50IHN0cmluZyBhbmQgZXh0cmFjdCBtaW1lIHR5cGVcclxuICAgICAgY29uc3QgYXJyID0gY29udGVudC5zcGxpdCgnLCcpLCBtaW1lID0gYXJyWzBdLm1hdGNoKC86KC4qPyk7LylbMV0sXHJcbiAgICAgICAgYnN0ciA9IGF0b2IoYXJyWzFdKTtcclxuICAgICAgbGV0IG4gPSBic3RyLmxlbmd0aDtcclxuICAgICAgY29uc3QgdThhcnIgPSBuZXcgVWludDhBcnJheShuKTtcclxuICAgICAgd2hpbGUgKG4tLSkge1xyXG4gICAgICAgIHU4YXJyW25dID0gYnN0ci5jaGFyQ29kZUF0KG4pO1xyXG4gICAgICB9XHJcbiAgICAgIG9ic2VydmVyLm5leHQobmV3IEJsb2IoW3U4YXJyXSwgeyB0eXBlOiBtaW1lIH0pKTtcclxuICAgICAgb2JzZXJ2ZXIuY29tcGxldGUoKTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogUmVtb3ZlcyBiYXNlNjQgZmlsZSB0eXBlIGZyb20gYSBzdHJpbmcgbGlrZSBcImRhdGE6dGV4dC9jc3Y7YmFzZTY0LFwiXHJcbiAgICogQHBhcmFtIGZpbGVDb250ZW50IHRoZSBiYXNlNjQgc3RyaW5nIHRvIHJlbW92ZSB0aGUgdHlwZSBmcm9tXHJcbiAgICovXHJcbiAgcmVtb3ZlRmlsZVR5cGVGcm9tQmFzZTY0KGZpbGVDb250ZW50OiBzdHJpbmcpOiBzdHJpbmcge1xyXG4gICAgY29uc3QgcmUgPSAvXmRhdGE6W15dKjtiYXNlNjQsL2c7XHJcbiAgICBjb25zdCBuZXdDb250ZW50OiBzdHJpbmcgPSByZVtTeW1ib2wucmVwbGFjZV0oZmlsZUNvbnRlbnQsICcnKTtcclxuICAgIHJldHVybiBuZXdDb250ZW50O1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogU3RydWN0dXJlIHRoZSBiYXNlNjQgZmlsZSBjb250ZW50IHdpdGggdGhlIGZpbGUgdHlwZSBzdHJpbmdcclxuICAgKiBAcGFyYW0gZmlsZUNvbnRlbnQgZmlsZSBjb250ZW50XHJcbiAgICogQHBhcmFtIGZpbGVNaW1lIGZpbGUgbWltZSB0eXBlIFwidGV4dC9jc3ZcIlxyXG4gICAqL1xyXG4gIGFkZEZpbGVUeXBlVG9CYXNlNjQoZmlsZUNvbnRlbnQ6IHN0cmluZywgZmlsZU1pbWU6IHN0cmluZyk6IHN0cmluZyB7XHJcbiAgICByZXR1cm4gYGRhdGE6JHtmaWxlTWltZX07YmFzZTY0LCR7ZmlsZUNvbnRlbnR9YDtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIGNyZWF0ZSBkb3dubG9hZGFibGUgZmlsZSBmcm9tIGRhdGFVUkxcclxuICAgKiBAcGFyYW0gZmlsZU5hbWUgZG93bmxvYWRhYmxlIGZpbGUgbmFtZVxyXG4gICAqIEBwYXJhbSBkYXRhVVJMIGZpbGUgY29udGVudCBhcyBkYXRhVVJMXHJcbiAgICovXHJcbiAgZG93bmxvYWRGcm9tRGF0YVVSTChmaWxlTmFtZTogc3RyaW5nLCBkYXRhVVJMOiBzdHJpbmcpOiB2b2lkIHtcclxuICAgIC8vIGNyZWF0ZSBibG9iXHJcbiAgICB0aGlzLmNvbnRlbnRUb0Jsb2IoZGF0YVVSTCkuc3Vic2NyaWJlKGJsb2IgPT4ge1xyXG4gICAgICAvLyBkb3dubG9hZCB0aGUgYmxvYlxyXG4gICAgICB0aGlzLmRvd25sb2FkRnJvbUJsb2IoYmxvYiwgZmlsZU5hbWUpO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBEb3dubG9hZHMgdGhlIGJsb2Igb2JqZWN0IGFzIGEgZmlsZVxyXG4gICAqIEBwYXJhbSBibG9iIGZpbGUgb2JqZWN0IGFzIGJsb2JcclxuICAgKiBAcGFyYW0gZmlsZU5hbWUgZG93bmxvYWRhYmxlIGZpbGUgbmFtZVxyXG4gICAqL1xyXG4gIGRvd25sb2FkRnJvbUJsb2IoYmxvYjogQmxvYiwgZmlsZU5hbWU6IHN0cmluZykge1xyXG4gICAgLy8gZ2V0IG9iamVjdCB1cmxcclxuICAgIGNvbnN0IHVybCA9IHdpbmRvdy5VUkwuY3JlYXRlT2JqZWN0VVJMKGJsb2IpO1xyXG4gICAgLy8gY2hlY2sgZm9yIG1pY3Jvc29mdCBpbnRlcm5ldCBleHBsb3JlclxyXG4gICAgaWYgKHdpbmRvdy5uYXZpZ2F0b3IgJiYgd2luZG93Lm5hdmlnYXRvci5tc1NhdmVPck9wZW5CbG9iKSB7XHJcbiAgICAgIC8vIHVzZSBJRSBkb3dubG9hZCBvciBvcGVuIGlmIHRoZSB1c2VyIHVzaW5nIElFXHJcbiAgICAgIHdpbmRvdy5uYXZpZ2F0b3IubXNTYXZlT3JPcGVuQmxvYihibG9iLCBmaWxlTmFtZSk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAvLyBpZiBub3QgdXNpbmcgSUUgdGhlbiBjcmVhdGUgbGluayBlbGVtZW50XHJcbiAgICAgIGNvbnN0IGVsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdhJyk7XHJcbiAgICAgIC8vIHNldCBkb3dubG9hZCBhdHRyIHdpdGggZmlsZSBuYW1lXHJcbiAgICAgIGVsZW1lbnQuc2V0QXR0cmlidXRlKCdkb3dubG9hZCcsIGZpbGVOYW1lKTtcclxuICAgICAgLy8gc2V0IHRoZSBlbGVtZW50IGFzIGhpZGRlblxyXG4gICAgICBlbGVtZW50LnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XHJcbiAgICAgIC8vIGFwcGVuZCB0aGUgYm9keVxyXG4gICAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGVsZW1lbnQpO1xyXG4gICAgICAvLyBzZXQgaHJlZiBhdHRyXHJcbiAgICAgIGVsZW1lbnQuaHJlZiA9IHVybDtcclxuICAgICAgLy8gY2xpY2sgb24gaXQgdG8gc3RhcnQgZG93bmxvYWRpbmdcclxuICAgICAgZWxlbWVudC5jbGljaygpO1xyXG4gICAgICAvLyByZW1vdmUgdGhlIGxpbmsgZnJvbSB0aGUgZG9tXHJcbiAgICAgIGRvY3VtZW50LmJvZHkucmVtb3ZlQ2hpbGQoZWxlbWVudCk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGdldFBERihjb25maWc6IEV4cG9ydEFzQ29uZmlnKTogT2JzZXJ2YWJsZTxzdHJpbmcgfCBudWxsPiB7XHJcbiAgICByZXR1cm4gT2JzZXJ2YWJsZS5jcmVhdGUoKG9ic2VydmVyKSA9PiB7XHJcbiAgICAgIGlmICghY29uZmlnLm9wdGlvbnMpIHtcclxuICAgICAgICBjb25maWcub3B0aW9ucyA9IHt9O1xyXG4gICAgICB9XHJcbiAgICAgIGNvbmZpZy5vcHRpb25zLmZpbGVuYW1lID0gY29uZmlnLmZpbGVOYW1lO1xyXG4gICAgICBjb25zdCBlbGVtZW50OiBIVE1MRWxlbWVudCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGNvbmZpZy5lbGVtZW50SWRPckNvbnRlbnQpO1xyXG4gICAgICBjb25zdCBwZGYgPSBodG1sMnBkZigpLnNldChjb25maWcub3B0aW9ucykuZnJvbShlbGVtZW50ID8gZWxlbWVudCA6IGNvbmZpZy5lbGVtZW50SWRPckNvbnRlbnQpO1xyXG5cclxuICAgICAgY29uc3QgZG93bmxvYWQgPSBjb25maWcuZG93bmxvYWQ7XHJcbiAgICAgIGNvbnN0IHBkZkNhbGxiYWNrRm4gPSBjb25maWcub3B0aW9ucy5wZGZDYWxsYmFja0ZuO1xyXG4gICAgICBpZiAoZG93bmxvYWQpIHtcclxuICAgICAgICBpZiAocGRmQ2FsbGJhY2tGbikge1xyXG4gICAgICAgICAgdGhpcy5hcHBseVBkZkNhbGxiYWNrRm4ocGRmLCBwZGZDYWxsYmFja0ZuKS5zYXZlKCk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgIHBkZi5zYXZlKCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIG9ic2VydmVyLm5leHQoKTtcclxuICAgICAgICBvYnNlcnZlci5jb21wbGV0ZSgpO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIGlmIChwZGZDYWxsYmFja0ZuKSB7XHJcbiAgICAgICAgICB0aGlzLmFwcGx5UGRmQ2FsbGJhY2tGbihwZGYsIHBkZkNhbGxiYWNrRm4pLm91dHB1dFBkZignZGF0YXVyaXN0cmluZycpLnRoZW4oZGF0YSA9PiB7XHJcbiAgICAgICAgICAgIG9ic2VydmVyLm5leHQoZGF0YSk7XHJcbiAgICAgICAgICAgIG9ic2VydmVyLmNvbXBsZXRlKCk7XHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgcGRmLm91dHB1dFBkZignZGF0YXVyaXN0cmluZycpLnRoZW4oZGF0YSA9PiB7XHJcbiAgICAgICAgICAgIG9ic2VydmVyLm5leHQoZGF0YSk7XHJcbiAgICAgICAgICAgIG9ic2VydmVyLmNvbXBsZXRlKCk7XHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBhcHBseVBkZkNhbGxiYWNrRm4ocGRmLCBwZGZDYWxsYmFja0ZuKSB7XHJcbiAgICByZXR1cm4gcGRmLnRvUGRmKCkuZ2V0KCdwZGYnKS50aGVuKChwZGZSZWYpID0+IHtcclxuICAgICAgcGRmQ2FsbGJhY2tGbihwZGZSZWYpO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGdldFBORyhjb25maWc6IEV4cG9ydEFzQ29uZmlnKTogT2JzZXJ2YWJsZTxzdHJpbmcgfCBudWxsPiB7XHJcbiAgICByZXR1cm4gT2JzZXJ2YWJsZS5jcmVhdGUoKG9ic2VydmVyKSA9PiB7XHJcbiAgICAgIGNvbnN0IGVsZW1lbnQ6IEhUTUxFbGVtZW50ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoY29uZmlnLmVsZW1lbnRJZE9yQ29udGVudCk7XHJcbiAgICAgIGh0bWwyY2FudmFzKGVsZW1lbnQsIGNvbmZpZy5vcHRpb25zKS50aGVuKChjYW52YXMpID0+IHtcclxuICAgICAgICBjb25zdCBpbWdEYXRhID0gY2FudmFzLnRvRGF0YVVSTCgnaW1hZ2UvUE5HJyk7XHJcbiAgICAgICAgaWYgKGNvbmZpZy50eXBlID09PSAncG5nJyAmJiBjb25maWcuZG93bmxvYWQpIHtcclxuICAgICAgICAgIHRoaXMuZG93bmxvYWRGcm9tRGF0YVVSTChjb25maWcuZmlsZU5hbWUsIGltZ0RhdGEpO1xyXG4gICAgICAgICAgb2JzZXJ2ZXIubmV4dCgpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICBvYnNlcnZlci5uZXh0KGltZ0RhdGEpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBvYnNlcnZlci5jb21wbGV0ZSgpO1xyXG4gICAgICB9LCBlcnIgPT4ge1xyXG4gICAgICAgIG9ic2VydmVyLmVycm9yKGVycik7XHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGdldENTVihjb25maWc6IEV4cG9ydEFzQ29uZmlnKTogT2JzZXJ2YWJsZTxzdHJpbmcgfCBudWxsPiB7XHJcbiAgICByZXR1cm4gT2JzZXJ2YWJsZS5jcmVhdGUoKG9ic2VydmVyKSA9PiB7XHJcbiAgICAgIGNvbnN0IGVsZW1lbnQ6IEhUTUxFbGVtZW50ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoY29uZmlnLmVsZW1lbnRJZE9yQ29udGVudCk7XHJcbiAgICAgIGNvbnN0IGNzdiA9IFtdO1xyXG4gICAgICBjb25zdCByb3dzOiBhbnkgPSBlbGVtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ3RhYmxlIHRyJyk7XHJcbiAgICAgIGZvciAobGV0IGluZGV4ID0gMDsgaW5kZXggPCByb3dzLmxlbmd0aDsgaW5kZXgrKykge1xyXG4gICAgICAgIGNvbnN0IHJvd0VsZW1lbnQgPSByb3dzW2luZGV4XTtcclxuICAgICAgICBjb25zdCByb3cgPSBbXTtcclxuICAgICAgICBjb25zdCBjb2xzID0gcm93RWxlbWVudC5xdWVyeVNlbGVjdG9yQWxsKCd0ZCwgdGgnKTtcclxuICAgICAgICBmb3IgKGxldCBjb2xJbmRleCA9IDA7IGNvbEluZGV4IDwgY29scy5sZW5ndGg7IGNvbEluZGV4KyspIHtcclxuICAgICAgICAgIGNvbnN0IGNvbCA9IGNvbHNbY29sSW5kZXhdO1xyXG4gICAgICAgICAgcm93LnB1c2goY29sLmlubmVyVGV4dCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGNzdi5wdXNoKHJvdy5qb2luKCcsJykpO1xyXG4gICAgICB9XHJcbiAgICAgIGNvbnN0IGNzdkNvbnRlbnQgPSAnZGF0YTp0ZXh0L2NzdjtiYXNlNjQsJyArIHRoaXMuYnRvYShjc3Yuam9pbignXFxuJykpO1xyXG4gICAgICBpZiAoY29uZmlnLmRvd25sb2FkKSB7XHJcbiAgICAgICAgdGhpcy5kb3dubG9hZEZyb21EYXRhVVJMKGNvbmZpZy5maWxlTmFtZSwgY3N2Q29udGVudCk7XHJcbiAgICAgICAgb2JzZXJ2ZXIubmV4dCgpO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIG9ic2VydmVyLm5leHQoY3N2Q29udGVudCk7XHJcbiAgICAgIH1cclxuICAgICAgb2JzZXJ2ZXIuY29tcGxldGUoKTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBnZXRUWFQoY29uZmlnOiBFeHBvcnRBc0NvbmZpZyk6IE9ic2VydmFibGU8c3RyaW5nIHwgbnVsbD4ge1xyXG4gICAgY29uc3QgbmFtZUZyYWdzID0gY29uZmlnLmZpbGVOYW1lLnNwbGl0KCcuJyk7XHJcbiAgICBjb25maWcuZmlsZU5hbWUgPSBgJHtuYW1lRnJhZ3NbMF19LnR4dGA7XHJcbiAgICByZXR1cm4gdGhpcy5nZXRDU1YoY29uZmlnKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgZ2V0WExTKGNvbmZpZzogRXhwb3J0QXNDb25maWcpOiBPYnNlcnZhYmxlPHN0cmluZyB8IG51bGw+IHtcclxuICAgIHJldHVybiBPYnNlcnZhYmxlLmNyZWF0ZSgob2JzZXJ2ZXIpID0+IHtcclxuXHJcbiAgICAgIGNvbnN0IGVsZW1lbnQ6IEhUTUxFbGVtZW50ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoY29uZmlnLmVsZW1lbnRJZE9yQ29udGVudCk7XHJcbiAgICAgIGNvbnN0IHdzMyA9IFhMU1gudXRpbHMudGFibGVfdG9fc2hlZXQoZWxlbWVudCwgY29uZmlnLm9wdGlvbnMpO1xyXG4gICAgICBjb25zdCB3YiA9IFhMU1gudXRpbHMuYm9va19uZXcoKTtcclxuICAgICAgWExTWC51dGlscy5ib29rX2FwcGVuZF9zaGVldCh3Yiwgd3MzLCBjb25maWcuZmlsZU5hbWUpO1xyXG4gICAgICBjb25zdCBvdXQgPSBYTFNYLndyaXRlKHdiLCB7IHR5cGU6ICdiYXNlNjQnIH0pO1xyXG4gICAgICBjb25zdCB4bHNDb250ZW50ID0gJ2RhdGE6YXBwbGljYXRpb24vdm5kLm9wZW54bWxmb3JtYXRzLW9mZmljZWRvY3VtZW50LnNwcmVhZHNoZWV0bWwuc2hlZXQ7YmFzZTY0LCcgKyBvdXQ7XHJcbiAgICAgIGlmIChjb25maWcuZG93bmxvYWQpIHtcclxuICAgICAgICB0aGlzLmRvd25sb2FkRnJvbURhdGFVUkwoY29uZmlnLmZpbGVOYW1lLCB4bHNDb250ZW50KTtcclxuICAgICAgICBvYnNlcnZlci5uZXh0KCk7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgb2JzZXJ2ZXIubmV4dCh4bHNDb250ZW50KTtcclxuICAgICAgfVxyXG4gICAgICBvYnNlcnZlci5jb21wbGV0ZSgpO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGdldFhMU1goY29uZmlnOiBFeHBvcnRBc0NvbmZpZyk6IE9ic2VydmFibGU8c3RyaW5nIHwgbnVsbD4ge1xyXG4gICAgcmV0dXJuIHRoaXMuZ2V0WExTKGNvbmZpZyk7XHJcbiAgfVxyXG5cclxuICAvLyBwcml2YXRlIGdldERPQ1goY29uZmlnOiBFeHBvcnRBc0NvbmZpZyk6IE9ic2VydmFibGU8c3RyaW5nIHwgbnVsbD4ge1xyXG4gIC8vICAgcmV0dXJuIE9ic2VydmFibGUuY3JlYXRlKChvYnNlcnZlcikgPT4ge1xyXG4gIC8vICAgICBjb25zdCBjb250ZW50RG9jdW1lbnQ6IHN0cmluZyA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGNvbmZpZy5lbGVtZW50SWRPckNvbnRlbnQpLm91dGVySFRNTDtcclxuICAvLyAgICAgY29uc3QgY29udGVudCA9ICc8IURPQ1RZUEUgaHRtbD4nICsgY29udGVudERvY3VtZW50O1xyXG4gIC8vICAgICBjb25zdCBjb252ZXJ0ZWQgPSBodG1sRG9jeC5hc0Jsb2IoY29udGVudCwgY29uZmlnLm9wdGlvbnMpO1xyXG4gIC8vICAgICBpZiAoY29uZmlnLmRvd25sb2FkKSB7XHJcbiAgLy8gICAgICAgdGhpcy5kb3dubG9hZEZyb21CbG9iKGNvbnZlcnRlZCwgY29uZmlnLmZpbGVOYW1lKTtcclxuICAvLyAgICAgICBvYnNlcnZlci5uZXh0KCk7XHJcbiAgLy8gICAgICAgb2JzZXJ2ZXIuY29tcGxldGUoKTtcclxuICAvLyAgICAgfSBlbHNlIHtcclxuICAvLyAgICAgICBjb25zdCByZWFkZXIgPSBuZXcgRmlsZVJlYWRlcigpO1xyXG4gIC8vICAgICAgIHJlYWRlci5vbmxvYWRlbmQgPSAoKSA9PiB7XHJcbiAgLy8gICAgICAgICBjb25zdCBiYXNlNjRkYXRhID0gcmVhZGVyLnJlc3VsdDtcclxuICAvLyAgICAgICAgIG9ic2VydmVyLm5leHQoYmFzZTY0ZGF0YSk7XHJcbiAgLy8gICAgICAgICBvYnNlcnZlci5jb21wbGV0ZSgpO1xyXG4gIC8vICAgICAgIH07XHJcbiAgLy8gICAgICAgcmVhZGVyLnJlYWRBc0RhdGFVUkwoY29udmVydGVkKTtcclxuICAvLyAgICAgfVxyXG4gIC8vICAgfSk7XHJcbiAgLy8gfVxyXG5cclxuICAvLyBwcml2YXRlIGdldERPQyhjb25maWc6IEV4cG9ydEFzQ29uZmlnKTogT2JzZXJ2YWJsZTxzdHJpbmcgfCBudWxsPiB7XHJcbiAgLy8gICByZXR1cm4gdGhpcy5nZXRET0NYKGNvbmZpZyk7XHJcbiAgLy8gfVxyXG5cclxuICBwcml2YXRlIGdldEpTT04oY29uZmlnOiBFeHBvcnRBc0NvbmZpZyk6IE9ic2VydmFibGU8YW55W10gfCBudWxsPiB7XHJcbiAgICByZXR1cm4gT2JzZXJ2YWJsZS5jcmVhdGUoKG9ic2VydmVyKSA9PiB7XHJcbiAgICAgIGNvbnN0IGRhdGEgPSBbXTsgLy8gZmlyc3Qgcm93IG5lZWRzIHRvIGJlIGhlYWRlcnNcclxuICAgICAgY29uc3QgaGVhZGVycyA9IFtdO1xyXG4gICAgICBjb25zdCB0YWJsZSA9IDxIVE1MVGFibGVFbGVtZW50PmRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGNvbmZpZy5lbGVtZW50SWRPckNvbnRlbnQpO1xyXG4gICAgICBmb3IgKGxldCBpbmRleCA9IDA7IGluZGV4IDwgdGFibGUucm93c1swXS5jZWxscy5sZW5ndGg7IGluZGV4KyspIHtcclxuICAgICAgICBoZWFkZXJzW2luZGV4XSA9IHRhYmxlLnJvd3NbMF0uY2VsbHNbaW5kZXhdLmlubmVySFRNTC50b0xvd2VyQ2FzZSgpLnJlcGxhY2UoLyAvZ2ksICcnKTtcclxuICAgICAgfVxyXG4gICAgICAvLyBnbyB0aHJvdWdoIGNlbGxzXHJcbiAgICAgIGZvciAobGV0IGkgPSAxOyBpIDwgdGFibGUucm93cy5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgIGNvbnN0IHRhYmxlUm93ID0gdGFibGUucm93c1tpXTsgY29uc3Qgcm93RGF0YSA9IHt9O1xyXG4gICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgdGFibGVSb3cuY2VsbHMubGVuZ3RoOyBqKyspIHtcclxuICAgICAgICAgIHJvd0RhdGFbaGVhZGVyc1tqXV0gPSB0YWJsZVJvdy5jZWxsc1tqXS5pbm5lckhUTUw7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGRhdGEucHVzaChyb3dEYXRhKTtcclxuICAgICAgfVxyXG4gICAgICBjb25zdCBqc29uU3RyaW5nID0gSlNPTi5zdHJpbmdpZnkoZGF0YSk7XHJcbiAgICAgIGNvbnN0IGpzb25CYXNlNjQgPSB0aGlzLmJ0b2EoanNvblN0cmluZyk7XHJcbiAgICAgIGNvbnN0IGRhdGFTdHIgPSAnZGF0YTp0ZXh0L2pzb247YmFzZTY0LCcgKyBqc29uQmFzZTY0O1xyXG4gICAgICBpZiAoY29uZmlnLmRvd25sb2FkKSB7XHJcbiAgICAgICAgdGhpcy5kb3dubG9hZEZyb21EYXRhVVJMKGNvbmZpZy5maWxlTmFtZSwgZGF0YVN0cik7XHJcbiAgICAgICAgb2JzZXJ2ZXIubmV4dCgpO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIG9ic2VydmVyLm5leHQoZGF0YSk7XHJcbiAgICAgIH1cclxuICAgICAgb2JzZXJ2ZXIuY29tcGxldGUoKTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBnZXRYTUwoY29uZmlnOiBFeHBvcnRBc0NvbmZpZyk6IE9ic2VydmFibGU8c3RyaW5nIHwgbnVsbD4ge1xyXG4gICAgcmV0dXJuIE9ic2VydmFibGUuY3JlYXRlKChvYnNlcnZlcikgPT4ge1xyXG4gICAgICBsZXQgeG1sID0gJzw/eG1sIHZlcnNpb249XCIxLjBcIiBlbmNvZGluZz1cIlVURi04XCI/PjxSb290PjxDbGFzc2VzPic7XHJcbiAgICAgIGNvbnN0IHRyaXRlbSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGNvbmZpZy5lbGVtZW50SWRPckNvbnRlbnQpLmdldEVsZW1lbnRzQnlUYWdOYW1lKCd0cicpO1xyXG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRyaXRlbS5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgIGNvbnN0IGNlbGxkYXRhID0gdHJpdGVtW2ldO1xyXG4gICAgICAgIGlmIChjZWxsZGF0YS5jZWxscy5sZW5ndGggPiAwKSB7XHJcbiAgICAgICAgICB4bWwgKz0gJzxDbGFzcyBuYW1lPVwiJyArIGNlbGxkYXRhLmNlbGxzWzBdLnRleHRDb250ZW50ICsgJ1wiPlxcbic7XHJcbiAgICAgICAgICBmb3IgKGxldCBtID0gMTsgbSA8IGNlbGxkYXRhLmNlbGxzLmxlbmd0aDsgKyttKSB7XHJcbiAgICAgICAgICAgIHhtbCArPSAnXFx0PGRhdGE+JyArIGNlbGxkYXRhLmNlbGxzW21dLnRleHRDb250ZW50ICsgJzwvZGF0YT5cXG4nO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgeG1sICs9ICc8L0NsYXNzPlxcbic7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICAgIHhtbCArPSAnPC9DbGFzc2VzPjwvUm9vdD4nO1xyXG4gICAgICBjb25zdCBiYXNlNjQgPSAnZGF0YTp0ZXh0L3htbDtiYXNlNjQsJyArIHRoaXMuYnRvYSh4bWwpO1xyXG4gICAgICBpZiAoY29uZmlnLmRvd25sb2FkKSB7XHJcbiAgICAgICAgdGhpcy5kb3dubG9hZEZyb21EYXRhVVJMKGNvbmZpZy5maWxlTmFtZSwgYmFzZTY0KTtcclxuICAgICAgICBvYnNlcnZlci5uZXh0KCk7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgb2JzZXJ2ZXIubmV4dChiYXNlNjQpO1xyXG4gICAgICB9XHJcbiAgICAgIG9ic2VydmVyLmNvbXBsZXRlKCk7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgYnRvYShjb250ZW50OiBzdHJpbmcpIHtcclxuICAgIHJldHVybiBidG9hKHVuZXNjYXBlKGVuY29kZVVSSUNvbXBvbmVudChjb250ZW50KSkpO1xyXG4gIH1cclxuXHJcbn1cclxuIl19