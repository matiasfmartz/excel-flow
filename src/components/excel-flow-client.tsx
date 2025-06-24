'use client';

import { useState, useCallback, useEffect, useRef, type DragEvent } from 'react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { UploadCloud, File, Loader2, CheckCircle2, History, XCircle, FileSpreadsheet } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

type Status = 'idle' | 'uploading' | 'preview' | 'processing' | 'completed' | 'error';
type LogEntry = {
  timestamp: string;
  message: string;
  type: 'info' | 'error';
};

const ACCEPTED_FILE_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel', // .xls
  'text/csv', // .csv
];

export function ExcelFlowClient() {
  const [status, setStatus] = useState<Status>('idle');
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sheetHeaders, setSheetHeaders] = useState<string[]>([]);
  const [jsonData, setJsonData] = useState<any[]>([]);

  const addLog = useCallback((message: string, type: 'info' | 'error' = 'info') => {
    const timestamp = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLogs((prev) => [{ timestamp, message, type }, ...prev]);
  }, []);

  const handleFileSelect = useCallback((selectedFile: File | undefined | null) => {
    if (!selectedFile) return;

    const isAccepted = ACCEPTED_FILE_TYPES.some(type => selectedFile.type.startsWith(type)) ||
      selectedFile.name.endsWith('.xlsx') ||
      selectedFile.name.endsWith('.xls') ||
      selectedFile.name.endsWith('.csv');

    if (!isAccepted) {
      const errorMsg = `Tipo de archivo inválido: ${selectedFile.name}. Por favor, sube un archivo .xlsx, .xls o .csv.`;
      addLog(errorMsg, 'error');
      toast({
        title: 'Formato de Archivo Inválido',
        description: 'Por favor, sube un archivo de Excel o CSV válido.',
        variant: 'destructive',
      });
      setStatus('error');
      return;
    }

    addLog(`Archivo seleccionado: "${selectedFile.name}"`);
    setFile(selectedFile);
    setProgress(0);
    setSheetHeaders([]);
    setJsonData([]);

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = e.target?.result;
            if (!data) {
                throw new Error("No se pudo leer el archivo.");
            }
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const parsedData: any[] = XLSX.utils.sheet_to_json(worksheet);
            
            if (parsedData.length > 0 && Object.keys(parsedData[0]).length > 0) {
                setSheetHeaders(Object.keys(parsedData[0]));
                setJsonData(parsedData);
                addLog('Datos del archivo analizados con éxito. Mostrando todos los datos de la hoja.');
            } else {
                addLog('El archivo seleccionado está vacío o no tiene datos.', 'error');
                toast({
                    title: 'Archivo Vacío',
                    description: 'El archivo de Excel o CSV seleccionado parece estar vacío.',
                    variant: 'destructive',
                });
                setStatus('error');
            }
        } catch (error) {
            const errorMsg = 'No se pudo analizar el archivo. Podría estar corrupto o en un formato no compatible.';
            addLog(errorMsg, 'error');
            toast({
                title: 'Error al Analizar el Archivo',
                description: errorMsg,
                variant: 'destructive',
            });
            setStatus('error');
        }
    };
    reader.onerror = () => {
        const errorMsg = 'Ocurrió un error al leer el archivo.';
        addLog(errorMsg, 'error');
        toast({
            title: 'Error al Leer el Archivo',
            description: errorMsg,
            variant: 'destructive',
        });
        setStatus('error');
    };
    reader.readAsArrayBuffer(selectedFile);

    setStatus('uploading');
  }, [addLog, toast]);

  useEffect(() => {
    if (status === 'uploading' && file) {
      addLog('Iniciando la carga del archivo...');
      const interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval);
            setStatus('preview');
            addLog(`"${file.name}" subido con éxito. Listo para previsualizar.`);
            return 100;
          }
          return prev + 10;
        });
      }, 150);
      return () => clearInterval(interval);
    }
  }, [status, file, addLog]);

  const simulateBackendProcessing = async (dataToProcess: any[]): Promise<boolean> => {
    addLog('Los datos ya están estructurados. Preparando para la descarga...', 'info');

    try {
        const jsonString = JSON.stringify(dataToProcess, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'processed_data.json';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        addLog('Se generó y descargó processed_data.json con éxito.', 'info');
        return true;
    } catch (error) {
        addLog('No se pudo generar el archivo JSON.', 'error');
        return false;
    }
  };

  const handleProcess = async () => {
    if (!jsonData.length) {
        toast({
            title: 'No Hay Datos para Procesar',
            description: 'No hay datos para procesar. Por favor, sube un archivo válido.',
            variant: 'destructive',
        });
        return;
    }

    setStatus('processing');
    addLog('Procesamiento de datos iniciado...', 'info');

    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const success = await simulateBackendProcessing(jsonData);

    if (success) {
        setStatus('completed');
        addLog('Procesamiento de datos completado con éxito.', 'info');
    } else {
        setStatus('error');
        toast({
            title: 'Falló el Procesamiento',
            description: 'No se pudo procesar y generar el archivo JSON.',
            variant: 'destructive',
        });
        addLog('Falló el procesamiento de datos.', 'error');
    }
  };

  const handleReset = () => {
    setStatus('idle');
    setFile(null);
    setProgress(0);
    setLogs([]);
    setSheetHeaders([]);
    setJsonData([]);
  };

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); };
  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    handleFileSelect(droppedFile);
  };

  const renderContent = () => {
    switch (status) {
      case 'idle':
      case 'error':
        return (
          <div
            className={cn(
              'relative flex flex-col items-center justify-center w-full p-10 border-2 border-dashed rounded-lg cursor-pointer transition-colors duration-300',
              isDragging ? 'border-primary bg-accent/20' : 'border-border hover:border-primary/50 hover:bg-accent/10'
            )}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <UploadCloud className="w-16 h-16 text-muted-foreground mb-4" />
            <p className="text-lg font-semibold text-foreground">Arrastra y suelta tu archivo de Excel aquí</p>
            <p className="text-sm text-muted-foreground">o haz clic para buscar</p>
            <p className="text-xs text-muted-foreground mt-2">Solo archivos .xlsx, .xls o .csv</p>
            <Input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".xlsx,.xls,.csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
              onChange={(e) => handleFileSelect(e.target.files?.[0])}
            />
             {status === 'error' && (
              <div className="absolute bottom-4 flex items-center text-destructive">
                <XCircle className="w-4 h-4 mr-2" />
                <span className="text-sm font-medium">La carga del archivo falló. Por favor, inténtalo de nuevo.</span>
              </div>
            )}
          </div>
        );
      case 'uploading':
        return (
          <div className="flex flex-col items-center justify-center w-full p-10">
            <File className="w-16 h-16 text-primary mb-4" />
            <p className="text-lg font-semibold text-foreground truncate max-w-full">{file?.name}</p>
            <p className="text-sm text-muted-foreground mb-4">Subiendo...</p>
            <Progress value={progress} className="w-full" />
          </div>
        );
      case 'preview':
      case 'processing':
      case 'completed':
        return (
          <div>
            <div className="flex items-center gap-4 mb-4">
              <FileSpreadsheet className="w-10 h-10 text-primary" />
              <div>
                <h3 className="text-lg font-bold">{file?.name}</h3>
                <p className="text-sm text-muted-foreground">Mostrando todos los datos de la hoja.</p>
              </div>
            </div>
            <Card>
              <CardContent className="p-0">
                <ScrollArea className="h-[500px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {sheetHeaders.map((header, index) => (
                            <TableHead key={`${header}-${index}`} className="font-bold sticky top-0 bg-card">{header}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {jsonData.map((row, rowIndex) => (
                          <TableRow key={rowIndex}>
                            {sheetHeaders.map((header, cellIndex) => (
                              <TableCell key={cellIndex}>{String(row[header] ?? '')}</TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        );
      default:
        return null;
    }
  };

  const renderFooter = () => {
    switch (status) {
      case 'preview':
        return (
          <Button onClick={handleProcess} className="w-full sm:w-auto" disabled={jsonData.length === 0}>Confirmar y Procesar Datos</Button>
        );
      case 'processing':
        return (
          <Button disabled className="w-full sm:w-auto">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Procesando...
          </Button>
        );
      case 'completed':
        return (
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full">
            <div className="flex items-center text-green-600">
              <CheckCircle2 className="mr-2 h-5 w-5" />
              <p className="font-semibold">Procesamiento Completado</p>
            </div>
            <Button onClick={handleReset} variant="outline" className="w-full sm:w-auto sm:ml-auto">Empezar de Nuevo</Button>
          </div>
        );
      case 'error':
         return (
          <Button onClick={handleReset} variant="outline" className="w-full sm:w-auto">
            Intentar de Nuevo
          </Button>
        );
      default:
        return null;
    }
  };

  return (
    <div className="w-full max-w-4xl space-y-6">
      <Card className="shadow-lg rounded-xl">
        <CardHeader>
          <CardTitle className="text-2xl font-bold flex items-center gap-2">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="text-primary"
            >
              <path
                d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path d="M14 2V8H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M12 18H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M8 18H8.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M12 13H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M8 13H8.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            ExcelFlow
          </CardTitle>
          <CardDescription>Sube, previsualiza y procesa tus archivos de Excel con facilidad.</CardDescription>
        </CardHeader>
        <CardContent>{renderContent()}</CardContent>
        {status !== 'idle' && (
          <CardFooter className="flex justify-center sm:justify-end">
            {renderFooter()}
          </CardFooter>
        )}
      </Card>
      {logs.length > 0 && (
        <Card className="shadow-lg rounded-xl">
          <CardHeader>
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <History className="w-5 h-5" />
              Logs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-48 w-full pr-4">
              <div className="space-y-2">
                {logs.map((log, index) => (
                  <div key={index} className={cn("flex items-start text-sm", log.type === 'error' ? 'text-destructive' : 'text-muted-foreground')}>
                    <span className="font-mono text-xs mr-4">{log.timestamp}</span>
                    <p className="flex-1">{log.message}</p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
