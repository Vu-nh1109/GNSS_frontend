import './App.css';
import { useEffect, useState } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Title } from 'chart.js';
import { Line } from 'react-chartjs-2';
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Title);

function TelemetryCharts() {
  const [selectedXAxis, setSelectedXAxis] = useState('continuous');
  const [station, setStation] = useState('TQBS');
  const [satelliteSystem, setSatelliteSystem] = useState('GPS');
  const [signalIdList, setSignalIdList] = useState([]);
  const [selectedSignalId, setSelectedSignalId] = useState('0');
  const [files, setFiles] = useState([]);
  const [rawFileDate, setRawFileDate] = useState('');
  const [rawFilePage, setRawFilePage] = useState(1);
  const [rawFilePageSize] = useState(10);
  const [rawFileTotal, setRawFileTotal] = useState(0);
  const [rawFileTotalPages, setRawFileTotalPages] = useState(1);
  const [telemetryRecords, setTelemetryRecords] = useState([]);
  const [selectedRawFileName, setSelectedRawFileName] = useState('');
  const [isFileLoading, setIsFileLoading] = useState(false);
  const [satelliteData, setSatelliteData] = useState({});
  const [labels, setLabels] = useState([]);
  const [selectedY1Axis, setSelectedY1Axis] = useState('avg_cn0');
  const [selectedY2Axis, setSelectedY2Axis] = useState('');
  const [selectedPointCount, setSelectedPointCount] = useState(50);

  const [prnList, setPrnList] = useState([]);
  const [prnChecked, setPrnChecked] = useState({});
  const [allChecked, setAllChecked] = useState(true);
  const [s4Filter, setS4Filter] = useState({ val1: '', val2: '' });
  const [eleFilter, setEleFilter] = useState({ val1: '', val2: '' });
  const [customFilter, setCustomFilter] = useState({ field: 'avg_cn0', val1: '', val2: '' });

  const s4Options = ['', '0.1', '0.2', '0.3', '0.4', '0.5', '0.6', '0.7', '0.8', '0.9', '1.0'];
  const elevationOptions = ['', '15', '30', '45', '60', '75'];

  const SATELLITE_SYSTEM_CONFIG = {
    GPS: { gnssId: '0', prnStart: 1, prnCount: 32 },
    SBAS: { gnssId: '1', prnStart: 120, prnCount: 39 },
    GLONASS: { gnssId: '6', prnStart: 38, prnCount: 24 },
    Galileo: { gnssId: '2', prnStart: 1, prnCount: 36 },
    QZSS: { gnssId: '5', prnStart: 193, prnCount: 10 },
    Beidou: { gnssId: '3', prnStart: 1, prnCount: 63 },
  };

  const SIGNAL_GROUPS_BY_GNSS = {
    // GPS
    '0': [
      { key: 'L1', label: 'L1', ids: [0] },
      { key: 'L2', label: 'L2', ids: [3, 4] },
      { key: 'L5', label: 'L5', ids: [6, 7] },
    ],
    // SBAS
    '1': [
      { key: 'L1', label: 'L1', ids: [0] },
      { key: 'L5', label: 'L5', ids: [1] },
    ],
    // Galileo
    '2': [
      { key: 'E1', label: 'E1', ids: [0, 1] },
      { key: 'E5a', label: 'E5a', ids: [3, 4] },
      { key: 'E5b', label: 'E5b', ids: [5, 6] },
      { key: 'E6', label: 'E6', ids: [2, 7] },
    ],
    // BeiDou
    '3': [
      { key: 'B1', label: 'B1', ids: [0, 1, 5] },
      { key: 'B2', label: 'B2', ids: [2, 3, 6] },
      { key: 'B3', label: 'B3', ids: [4, 7] },
    ],
    // QZSS
    '5': [
      { key: 'L1', label: 'L1', ids: [0, 1] },
      { key: 'L2', label: 'L2', ids: [4, 5] },
      { key: 'L5', label: 'L5', ids: [8, 9] },
      { key: 'L6', label: 'L6', ids: [6, 7] },
    ],
    // GLONASS
    '6': [
      { key: 'G1', label: 'G1', ids: [0] },
      { key: 'G2', label: 'G2', ids: [2, 3] },
      { key: 'G3', label: 'G3', ids: [4] },
    ],
  };

  const getSignalGroupFromGnssSigId = (gnss, sigId) => {
    const g = String(gnss);
    const s = Number(sigId);
    const groups = SIGNAL_GROUPS_BY_GNSS[g] || [];
    const match = groups.find(group => group.ids.includes(s));
    if (match) return { key: match.key, label: match.label };
    return { key: `SIG_${String(sigId)}`, label: `sigId ${String(sigId)}` };
  };

  const getPrnFromGnssSvid = (gnss, svid) => {
    const g = String(gnss);
    const n = Number(svid);
    if (!Number.isFinite(n)) return null;

    switch (g) {
      case '6': // GLONASS: normalize 1..24 => 38..61
        if (n >= 1 && n <= 24) return String(n + 37);
        if (n >= 38 && n <= 61) return String(n);
        return null;
      default:
        return String(n);
    }
  };

  const targetGnssId = SATELLITE_SYSTEM_CONFIG[satelliteSystem]?.gnssId ?? '';
  const STATION_DEVICE_MAP = {
    TQBS: 'GNSS_01',
    Test_Station: 'GNSS_02',
  };
  const selectedDeviceId = STATION_DEVICE_MAP[station] || 'GNSS_01';

  // Khi satellite thay đổi, cập nhật giá trị gnssId và danh sách PRN tương ứng
  useEffect(() => {
    const cfg = SATELLITE_SYSTEM_CONFIG[satelliteSystem];
    const list = cfg
      ? Array.from({ length: cfg.prnCount }, (_, i) => String(cfg.prnStart + i))
      : [];
    setPrnList(list);
    const checked = {};
    list.forEach(p => checked[p] = true);
    setPrnChecked(checked);
    setAllChecked(true);
  }, [satelliteSystem]);

  useEffect(() => {
    if (signalIdList.length === 0) {
      if (selectedSignalId !== '') setSelectedSignalId('');
      return;
    }

    const hasSelected = signalIdList.some(sig => sig.key === selectedSignalId);
    if (!hasSelected) {
      setSelectedSignalId(signalIdList[0].key);
    }
  }, [signalIdList, selectedSignalId]);

  const togglePrn = (prn) => {
    setPrnChecked(prev => {
      const currentlyChecked = Object.prototype.hasOwnProperty.call(prev, prn) ? prev[prn] : true;
      const next = { ...prev, [prn]: !currentlyChecked };
      setAllChecked(Object.values(next).every(v => v));
      return next;
    });
  };

  const toggleAllPrns = () => {
    const next = !allChecked;
    const checked = {};
    prnList.forEach(p => checked[p] = next);
    setPrnChecked(checked);
    setAllChecked(next);
  };

  // Backend
  const BACKEND_HOST = process.env.REACT_APP_BACKEND_HOST || 'localhost:3001';
  const HTTP_PROTO = window.location.protocol === 'https:' ? 'https' : 'http';
  const BACKEND_HTTP = `${HTTP_PROTO}://${BACKEND_HOST}`;
  const WS_PROTO = window.location.protocol === 'https:' ? 'wss' : 'ws';

  const toTelemetryArray = (payload) => {
    if (Array.isArray(payload)) return payload;
    if (payload && Array.isArray(payload.data)) return payload.data;
    return [];
  };

  useEffect(() => {
    const telemetry = toTelemetryArray(telemetryRecords);
    if (!telemetry.length) {
      setLabels([]);
      setSignalIdList([]);
      setSatelliteData({});
      return;
    }

    const uniqueTimestamps = [...new Set(telemetry.map(record => record.timestamp))].sort();
    setLabels(uniqueTimestamps);

    const rawSats = telemetry.flatMap(rec => (Array.isArray(rec.sats) ? rec.sats : []).map(sat => ({ ...sat, timestamp: rec.timestamp })));

    const filteredDataByGnss = rawSats.filter(sat => String(sat.gnss) === targetGnssId);
    const normalizedByPrn = filteredDataByGnss
      .map(sat => ({ ...sat, prn: getPrnFromGnssSvid(sat.gnss, sat.svid) }))
      .filter(sat => sat.prn !== null);

    const uniquePrns = [...new Set(normalizedByPrn.map(sat => sat.prn))];
    const uniqueSignalGroups = [
      ...new Map(
        normalizedByPrn
          .filter(sat => sat.sigId !== null && sat.sigId !== undefined)
          .map(sat => {
            const group = getSignalGroupFromGnssSigId(sat.gnss, sat.sigId);
            return [group.key, group];
          })
      ).values()
    ];
    setSignalIdList(uniqueSignalGroups);

    // Build fast lookup maps once to avoid repeated array scans per PRN/timestamp.
    const signalByPrnTimestamp = new Map();
    const elevationByPrnTimestamp = new Map();
    normalizedByPrn.forEach(sat => {
      const key = `${sat.prn}|${sat.timestamp}`;
      if (sat.elevation !== undefined && sat.elevation !== null && !elevationByPrnTimestamp.has(key)) {
        elevationByPrnTimestamp.set(key, sat.elevation);
      }

      if (sat.sigId !== null && sat.sigId !== undefined) {
        const group = getSignalGroupFromGnssSigId(sat.gnss, sat.sigId);
        if (group.key === selectedSignalId && !signalByPrnTimestamp.has(key)) {
          signalByPrnTimestamp.set(key, sat);
        }
      }
    });

    const groupedData = {};
    uniquePrns.forEach(prn => {
      uniqueTimestamps.forEach(timestamp => {
        const key = `${prn}|${timestamp}`;
        const sat = signalByPrnTimestamp.get(key);
        const elev = elevationByPrnTimestamp.get(key);
        if (sat) {
          if (!groupedData[prn]) groupedData[prn] = [];
          if (elev !== undefined && elev !== null) sat.elevation = elev;
          groupedData[prn].push(sat);
        } else {
          if (!groupedData[prn]) groupedData[prn] = [];
          groupedData[prn].push({ svid: null, prn, timestamp, cn0: null, elevation: elev, ccd: null, sigmaCcd: null, s4: null });
        }
      });
    });
    setSatelliteData(groupedData);
  }, [telemetryRecords, targetGnssId, selectedSignalId]);

  useEffect(() => {
    if (selectedXAxis !== 'static') {
      setIsFileLoading(false);
      return;
    }

    setSelectedRawFileName('');
    setTelemetryRecords([]);
    setIsFileLoading(false);
  }, [selectedXAxis, selectedDeviceId]);

  const handleLoadFileData = (fileName) => {
    if (selectedXAxis !== 'static') return;

    const params = new URLSearchParams({
      device: selectedDeviceId,
      //gnss: targetGnssId,
    });

    setSelectedRawFileName(fileName);
    setIsFileLoading(true);
    setTelemetryRecords([]);

    fetch(`${BACKEND_HTTP}/api/fileData/${encodeURIComponent(fileName)}?${params.toString()}`)
      .then(response => {
        if (!response.ok) {
          throw new Error(`Failed to load file data: HTTP ${response.status}`);
        }
        return response.json();
      })
      .then(payload => {
        setTelemetryRecords(toTelemetryArray(payload));
      })
      .catch(error => {
        console.error('Error fetching file data:', error);
        setTelemetryRecords([]);
      })
      .finally(() => {
        setIsFileLoading(false);
      });
  };

  // Lấy danh sách file raw từ backend và thiết lập WebSocket để nhận dữ liệu telemetry
  useEffect(() => {
    if (selectedXAxis !== 'continuous') {
      return () => {};
    }

    let mounted = true;
    let socket;
    let reconnectTimer;
    let reconnectAttempts = 0;

    const getReconnectDelay = () => Math.min(1000 * 2 ** reconnectAttempts, 30000);

    const connectWebSocket = () => {
      socket = new WebSocket(`${WS_PROTO}://${BACKEND_HOST}?device=${encodeURIComponent(selectedDeviceId)}&gnss=${encodeURIComponent(targetGnssId)}`);

      socket.onopen = () => {
        console.log('WebSocket connection established');
        reconnectAttempts = 0;
        document.getElementById('ws-error-row')?.remove();
      };

      socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'data') {
          setTelemetryRecords(toTelemetryArray(data.data));
        }
      };

      socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        // 1. Prevent duplicate error rows if one is already visible
        if (document.getElementById('ws-error-row')) return;

        // 2. Create the full-width alert row
        const errorRow = document.createElement('div');
        errorRow.id = 'ws-error-row';
        errorRow.textContent = `WebSocket error: ${error?.message || 'Unknown error'}`;

        // 3. Style it to look like a system bar at the top
        Object.assign(errorRow.style, {
          width: '100%',
          backgroundColor: '#ff0000',
          color: '#ffffff',
          borderBottom: '1px solid #f8cbcb',
          padding: '12px 20px',
          textAlign: 'center',
          fontFamily: 'sans-serif',
          fontWeight: 'bold',
          boxSizing: 'border-box'
        });

        // 4. Inject it at the very top of the page body
        document.body.prepend(errorRow);
      };

      socket.onclose = (event) => {
        console.log('WebSocket connection closed', event);
        if (!mounted) {
          return;
        }

        const delay = getReconnectDelay();
        reconnectTimer = setTimeout(() => {
          reconnectAttempts += 1;
          console.log(`Reconnecting WebSocket in ${delay}ms...`);
          connectWebSocket();
        }, delay);
      };
    };

    connectWebSocket();
    return () => {
      mounted = false;
      clearTimeout(reconnectTimer);
      if (socket) {
        socket.close();
      }
    };
  }, [selectedXAxis, targetGnssId, selectedDeviceId]);

  useEffect(() => {
    let mounted = true;

    const fetchFiles = () => {
      const params = new URLSearchParams({
        device: selectedDeviceId,
        page: String(rawFilePage),
        pageSize: String(rawFilePageSize),
      });
      if (rawFileDate) {
        params.set('date', rawFileDate);
      }

      fetch(`${BACKEND_HTTP}/api/files?${params.toString()}`)
        .then(response => response.json())
        .then(data => {
          if (!mounted) return;

          if (Array.isArray(data)) {
            setFiles(data);
            setRawFileTotal(data.length);
            setRawFileTotalPages(1);
            return;
          }

          const items = Array.isArray(data.items) ? data.items : [];
          const pagination = data.pagination || {};
          setFiles(items);
          setRawFileTotal(Number(pagination.total) || 0);
          setRawFileTotalPages(Math.max(Number(pagination.totalPages) || 1, 1));
        })
        .catch(error => console.error('Error fetching files:', error));
    };

    fetchFiles();
    const id = setInterval(fetchFiles, 10000);

    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, [BACKEND_HTTP, selectedDeviceId, rawFilePage, rawFilePageSize, rawFileDate]);

  const generateColors = (count) => { // Tạo một dải màu sắc khác nhau dựa trên số lượng cần thiết
    const colors = [];
    const hueStep = 360 / Math.max(count, 1);
    for (let i = 0; i < count; i++) {
      colors.push(`hsl(${i * hueStep}, 70%, 50%)`);
    }
    return colors;
  };

  const getAxisValue = (sat, axisKey) => {
    switch (axisKey) {
      case 'avg_cn0':
        return sat.cn0;
      case 'avg_elev':
        return sat.elevation;
      case 'avgS4':
        return sat.s4;
      case 'avgCCD':
        return sat.ccd;
      case 'sigmaCCD':
        return sat.sigmaCcd;
      default:
        return sat[axisKey];
    }
  };

  const getAxisMeta = (axisKey) => {
    switch (axisKey) {
      case 'avg_cn0':
        return { label: 'avg_cn0', unit: 'dB-Hz' };
      case 'avg_elev':
        return { label: 'avgElevation', unit: 'deg' };
      case 'avgS4':
        return { label: 'avgS4', unit: '-' };
      case 'avgCCD':
        return { label: 'avgCCD', unit: 'm' };
      case 'sigmaCCD':
        return { label: 'sigmaCCD', unit: 'm' };
      default:
        return { label: axisKey, unit: '' };
    }
  };

  const parseNumericFilterValue = (value) => {
    if (value === '' || value === null || value === undefined) return null;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  };

  const passesNumericFilter = (value, filter) => {
    const first = parseNumericFilterValue(filter.val1);
    const second = parseNumericFilterValue(filter.val2);
    if (first === null && second === null) return true;
    if (value === null || value === undefined) return false;

    let ok = true;
    if (first !== null) {
      ok = ok && value <= first;
    }
    if (second !== null) {
      ok = ok && value >= second;
    }
    return ok;
  };

  const passesFilters = (sat) => {
    if (!passesNumericFilter(sat.s4, s4Filter)) return false;
    if (!passesNumericFilter(sat.elevation, eleFilter)) return false;
    const customValue = getAxisValue(sat, customFilter.field);
    return passesNumericFilter(customValue, customFilter);
  };

  const clearAllFilters = () => {
    setS4Filter({ val1: '', val2: '' });
    setEleFilter({ val1: '', val2: '' });
    setCustomFilter(prev => ({ ...prev, val1: '', val2: '' }));
  };

  const handleCustomNumericInput = (field, value) => {
    if (/^[0-9]*\.?[0-9]*$/.test(value)) {
      setCustomFilter(prev => ({ ...prev, [field]: value }));
    }
  };

  const roundUp = (value, decimals = 2) => {
    const factor = 10 ** decimals;
    return Math.round(value * factor) / factor;
  };

  const chartData = () => {
    const y1Meta = getAxisMeta(selectedY1Axis);
    const y2Meta = selectedY2Axis ? getAxisMeta(selectedY2Axis) : null;
    //const chunkSize = Math.ceil(100/selectedPointCount);
    const chunkSize = Math.ceil(labels.length/selectedPointCount);
    const selectedPRNs = Object.keys(satelliteData).filter(prn => prnChecked[prn] !== false);
    const satellitePRNs = selectedPRNs.filter(prn => {
      const sats = satelliteData[prn] || [];
      const y1HasData = sats.some(sat => passesFilters(sat) && getAxisValue(sat, selectedY1Axis) !== null && getAxisValue(sat, selectedY1Axis) !== undefined);
      if (!selectedY2Axis) return y1HasData;
      const y2HasData = sats.some(sat => passesFilters(sat) && getAxisValue(sat, selectedY2Axis) !== null && getAxisValue(sat, selectedY2Axis) !== undefined);
      return y1HasData || y2HasData;
    });
    const colors = generateColors(satellitePRNs.length);
    const datasets = [];
    
    if (!selectedY2Axis) {
      satellitePRNs.forEach((prn, index) => {
        const dataPoints = satelliteData[prn].map(sat => passesFilters(sat) ? getAxisValue(sat, selectedY1Axis) : null);
        const averagedPoints = [];
        for (let i = 0; i < dataPoints.length; i += chunkSize) {
          const chunk = dataPoints.slice(i, i + chunkSize).filter(val => val !== null);
          /*
          if (chunk.every(val => val === null || val === undefined)) {
            averagedPoints.push(null); // Nếu tất cả giá trị trong chunk đều null/undefined, giữ nguyên null để tránh vẽ sai
          } else {
            const avg = chunk.reduce((sum, val) => sum + (val || 0), 0) / chunk.length;
            averagedPoints.push(avg);
          }
          */
          if (chunk.length === 0)
            averagedPoints.push(null);
          else {
            const avg = roundUp(chunk.reduce((sum, val) => sum + (val || 0), 0) / chunk.length, 4);
            averagedPoints.push(avg);
          }
        }
        datasets.push({
          label: `PRN ${prn} (${y1Meta.label}${y1Meta.unit ? ` ${y1Meta.unit}` : ''})`,
          data: averagedPoints,
          yAxisID: `yLeft`,
          borderColor: colors[index],
          backgroundColor: colors[index],
          borderWidth: 2,
        });
      });
    } else {
      satellitePRNs.forEach((prn, index) => {
        const y1DataRaw = satelliteData[prn].map(sat => passesFilters(sat) ? getAxisValue(sat, selectedY1Axis) : null);
        const y2DataRaw = satelliteData[prn].map(sat => passesFilters(sat) ? getAxisValue(sat, selectedY2Axis) : null);

        // Downsample Y1 data
        const y1Data = [];
        for (let i = 0; i < y1DataRaw.length; i += chunkSize) {
          const chunk = y1DataRaw.slice(i, i + chunkSize).filter(val => val !== null);
          if (chunk.length === 0) {
            y1Data.push(null);
          } else {
            const avg = roundUp(chunk.reduce((sum, val) => sum + (val || 0), 0) / chunk.length, 4);
            y1Data.push(avg);
          }
        }

        // Downsample Y2 data
        const y2Data = [];
        for (let i = 0; i < y2DataRaw.length; i += chunkSize) {
          const chunk = y2DataRaw.slice(i, i + chunkSize).filter(val => val !== null).filter(val => val !== null);
          if (chunk.length === 0) {
            y2Data.push(null);
          } else {
            const avg = roundUp(chunk.reduce((sum, val) => sum + (val || 0), 0) / chunk.length, 4);
            y2Data.push(avg);
          }
        }

        datasets.push({
          label: `PRN ${prn} (${y1Meta.label}${y1Meta.unit ? ` ${y1Meta.unit}` : ''})`,
          data: y1Data,
          yAxisID: `yLeft`,
          borderColor: colors[index],
          backgroundColor: colors[index],
          borderWidth: 2,
        });

        datasets.push({
          label: `PRN ${prn} (${y2Meta ? y2Meta.label : selectedY2Axis}${y2Meta && y2Meta.unit ? ` ${y2Meta.unit}` : ''})`,
          data: y2Data,
          yAxisID: `yRight`,
          borderColor: colors[index],
          backgroundColor: colors[index],
          borderDash: [5, 5],
          borderWidth: 2,
        });
      });
    }

    // Downsample labels to match point count
    const downsampledLabels = [];
    for (let i = 0; i < labels.length; i += chunkSize) {
      downsampledLabels.push(labels[i]);
    }

    return {
      labels: downsampledLabels,
      datasets: datasets
    };
  };

  const y1Meta = getAxisMeta(selectedY1Axis);
  const y2Meta = selectedY2Axis ? getAxisMeta(selectedY2Axis) : null;

  const options = {
    responsive: true,
    interaction: {
      //mode: 'index',
      mode: 'nearest', // Only targets the closest data point
      axis: 'xy',      // Checks proximity on both horizontal and vertical axes
      intersect: false,
    },
    elements: {
      point:{
        radius: 0
      }
    },
    stacked: false,
    plugins: {
      title: {
        display: true,
        text: 'Station ' + station + ' (' + satelliteSystem + ')',
      },
      legend: {
        position: 'right',
        labels: {
          boxWidth: 12,     // Shrink color box width (default is 40)
          boxHeight: 12,    // Shrink color box height
          padding: 8,       // Reduce padding between legend items
          font: {
            size: 10        // Make text smaller
          }
        }
      },
      tooltip: {
        callbacks: {
        title: function(tooltipItems) {
          const rawTimestamp = tooltipItems[0]?.label;
          if (!rawTimestamp) return '';
          const date = new Date(rawTimestamp.replace(/Z$/, ''));
          return date.toLocaleDateString('en-US', { 
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit',
            hour12: false 
          });
        },
        label: function(context) {
          const value = context.parsed && context.parsed.y;
          const axisMeta = context.dataset.yAxisID === 'yRight' && y2Meta ? y2Meta : y1Meta;
          if (value === null || value === undefined) return `${context.dataset.label}: -`;
          return `${context.dataset.label}: ${value}${axisMeta.unit ? ` ${axisMeta.unit}` : ''}`;
        },
      }
      }
    },
    scales: {
      yLeft: {
        type: 'linear',
        display: true,
        position: 'left',
        title: {
          display: true,
          text: `${y1Meta.label}${y1Meta.unit ? ` (${y1Meta.unit})` : ''}`,
        },
      },
      x: {
        ticks: {
          //  FORCE THE CHART AXIS TO ONLY SHOW HH:MM:SS
          callback: function(val, index) {
            const fullLabel = this.getLabelForValue(val);
            const date = new Date(fullLabel.replace(/Z$/, ''));
            return date.toLocaleTimeString("it-IT"); // Returns "16:36:29"
          }
        }
      }
    },
  };

  if (selectedY2Axis) {
    options.scales.yRight = {
      type: 'linear',
      display: true,
      position: 'right',
      title: {
        display: true,
        text: `${y2Meta ? y2Meta.label : selectedY2Axis}${y2Meta && y2Meta.unit ? ` (${y2Meta.unit})` : ''}`,
      },
      grid: {
        drawOnChartArea: false,
      },
    };
  }

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', fontSize: '13px' }}>
      <div style={{ display: 'flex', width: '100%', alignItems: 'stretch' }}>
        <div style={{ flex: 1, width: '50%' }}>
          <table className='header-table' border="1" style={{ width: '100%', height: '100%' }} cellPadding="5" cellSpacing="0">
            <tbody>
              <tr>
                <td>Station(s)</td>
                <td><select id="station" name="stations" onChange={e => setStation(e.target.value)}>
                  <option value="TQBS">TQBS (Navis)</option>
                </select></td>
              </tr>
              <tr>
                <td>Satellite(s)</td>
                <td><select id="satelliteSystem" name="satelliteSystem" value={satelliteSystem} onChange={e => { setSatelliteSystem(e.target.value); }}>
                  <option value="GPS">GPS</option>
                  <option value="GLONASS">GLONASS</option>
                  <option value="Galileo">Galileo</option>
                  <option value="SBAS">SBAS</option>
                  <option value="Beidou">Beidou</option>
                  <option value="QZSS">QZSS</option>
                </select></td>
              </tr>
              <tr>
                <td>S4</td>
                <td>
                  <select id="s4_val1" name="s4_val1" value={s4Filter.val1} onChange={e => setS4Filter(prev => ({ ...prev, val1: e.target.value }))} title="Lọc giá trị S4 nhỏ hơn hoặc bằng">
                    {s4Options.map(option => (
                      <option key={`s4-val1-${option}`} value={option}>{option === '' ? '--' : option}</option>
                    ))}
                  </select> &nbsp;
                  <span style={{ fontWeight: 'bold' }}>&ge;</span> &nbsp;
                  <select id="s4_val2" name="s4_val2" value={s4Filter.val2} onChange={e => setS4Filter(prev => ({ ...prev, val2: e.target.value }))} title="Lọc giá trị S4 lớn hơn hoặc bằng">
                    {s4Options.map(option => (
                      <option key={`s4-val2-${option}`} value={option}>{option === '' ? '--' : option}</option>
                    ))}
                  </select>
                </td>
              </tr>
              <tr>
                <td>Elevation Angle</td>
                <td>
                  <select id="ele_val1" name="ele_val1" value={eleFilter.val1} onChange={e => setEleFilter(prev => ({ ...prev, val1: e.target.value }))} title="Lọc giá trị Elevation nhỏ hơn hoặc bằng">
                    {elevationOptions.map(option => (
                      <option key={`ele-val1-${option}`} value={option}>{option === '' ? '--' : option}</option>
                    ))}
                  </select> &nbsp;
                  <span style={{ fontWeight: 'bold' }}>&ge;</span> &nbsp;
                  <select id="ele_val2" name="ele_val2" value={eleFilter.val2} onChange={e => setEleFilter(prev => ({ ...prev, val2: e.target.value }))} title="Lọc giá trị Elevation lớn hơn hoặc bằng">
                    {elevationOptions.map(option => (
                      <option key={`ele-val2-${option}`} value={option}>{option === '' ? '--' : option}</option>
                    ))}
                  </select>
                </td>
              </tr>
              <tr>
                <td>(Custom filter)<br /> <select id="custom-filter" name="custom-filter" value={customFilter.field} onChange={e => setCustomFilter(prev => ({ ...prev, field: e.target.value }))}>
                  <option value="avg_cn0">avg_cn0</option>
                  <option value="avgCCD">avgCCD</option>
                  <option value="sigmaCCD">sigmaCCD</option>
                </select></td>
                <td>
                  <input
                    id="custom_val1"
                    name="custom_val1"
                    type="text"
                    inputMode="decimal"
                    pattern="[0-9.]*"
                    value={customFilter.val1}
                    onChange={e => handleCustomNumericInput('val1', e.target.value)}
                    style={{ width: '56px' }}
                  /> &nbsp;
                  <span style={{ fontWeight: 'bold' }}>&ge;</span> &nbsp;
                  <input
                    id="custom_val2"
                    name="custom_val2"
                    type="text"
                    inputMode="decimal"
                    pattern="[0-9.]*"
                    value={customFilter.val2}
                    onChange={e => handleCustomNumericInput('val2', e.target.value)}
                    style={{ width: '56px' }}
                  /> &nbsp;
                  <button type="button" style={{ marginLeft: '5px', padding: '2px 6px' }} onClick={clearAllFilters}>Clear Filters</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div style={{ flex: 1, width: '50%' }}>
          <table className='header-table' border="1" style={{ width: '100%', height: '100%' }} cellPadding="5" cellSpacing="0">
            <tbody>
              <tr>
                <td>X-axis/label</td>
                <td><select id="x-axis" name="x-axis" value={selectedXAxis} onChange={e => setSelectedXAxis(e.target.value)}>
                  <option value="continuous">Continuous Time</option>
                  <option value="static">File View</option>
                </select> Point Count &nbsp; 
                  <select id="point-count" name="point-count" value={selectedPointCount} onChange={e => setSelectedPointCount(Number(e.target.value))}>
                    <option value="50">50</option>
                    <option value="100">100</option>
                    <option value="200">200</option>
                    {selectedXAxis === 'static' && (
                      <option value="400">400</option>
                    )}
                  </select> Ticks
                </td>
              </tr>
              <tr>
                <td>(Plot 1) Y-axis/label</td>
                <td><select id="y1-axis" name="y1-axis" className="y-axis-select" onChange={e => setSelectedY1Axis(e.target.value)}>
                  <option value="avg_cn0" disabled={selectedY2Axis === 'avg_cn0'}>avg_cn0</option>
                  <option value="avg_elev" disabled={selectedY2Axis === 'avg_elev'}> avgElevation</option>
                  <option value="avgS4" disabled={selectedY2Axis === 'avgS4'}> avgS4</option>
                  <option value="avgCCD" disabled={selectedY2Axis === 'avgCCD'}> avgCCD</option>
                  <option value="sigmaCCD" disabled={selectedY2Axis === 'sigmaCCD'}> Total CCD</option>
                </select> &nbsp;
                  <select id="signalId" name="signalId" value={selectedSignalId} onChange={e=> setSelectedSignalId(e.target.value)}>
                    {signalIdList.map(sig => (
                      <option key={sig.key} value={sig.key}> {sig.label} </option>
                    ))}
                  </select> &nbsp;
                  {/*<input type="checkbox" id="y1-normalize" name="y1-normalize" /> Normalization */}
                </td>
              </tr>
              <tr>
                <td>(Plot 2) Y-axis/label</td>
                <td><select id="y2-axis" name="y2-axis" className="y-axis-select" onChange={e => setSelectedY2Axis(e.target.value)}>
                  <option value="">-- None --</option>
                  <option value="avg_cn0" disabled={selectedY1Axis === 'avg_cn0'}>avg_cn0</option>
                  <option value="avg_elev" disabled={selectedY1Axis === 'avg_elev'}>avgElevation</option>
                  <option value="avgS4" disabled={selectedY1Axis === 'avgS4'}>avgS4</option>
                  <option value="avgCCD" disabled={selectedY1Axis === 'avgCCD'}>avgCCD</option>
                  <option value="sigmaCCD" disabled={selectedY1Axis === 'sigmaCCD'}>sigmaCCD</option>
                </select> &nbsp; (right hand side axis - dash dotted lines)
                  &nbsp;
                  {/*<input type="checkbox" id="y2-normalize" name="y2-normalize" /> Normalization */}
                </td>
              </tr>
              <tr>
                <td>Title</td>
                <td>
                  <input
                    type="text"
                    value={`Station ${station} (${satelliteSystem})`}
                    readOnly
                    style={{ width: '99%' }}
                  />
                </td>
              </tr>
              <tr>
              </tr>
              <tr>
                <td>System</td>
                <td>
                  <button style={{ marginLeft: '5px', padding: '2px 6px' }} onClick={() => setSatelliteSystem('GPS')}>GPS</button>
                  <button style={{ marginLeft: '5px', padding: '2px 6px' }} onClick={() => setSatelliteSystem('GLONASS')}>Glonass</button>
                  <button style={{ marginLeft: '5px', padding: '2px 6px' }} onClick={() => setSatelliteSystem('Galileo')}>Galileo</button>
                  <button style={{ marginLeft: '5px', padding: '2px 6px' }} onClick={() => setSatelliteSystem('SBAS')}>SBAS</button>
                  <button style={{ marginLeft: '5px', padding: '2px 6px' }} onClick={() => setSatelliteSystem('Beidou')}>Beidou</button>
                  <button style={{ marginLeft: '5px', padding: '2px 6px' }} onClick={() => setSatelliteSystem('QZSS')}>QZSS</button></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: 'flex', marginTop: '10px', width: '100%' }}>
        <div style={{ flex: 8 }}>
          <table border="1" style={{ width: '100%' }} cellPadding="5" cellSpacing="0">
            <tbody>
              <tr>
                <td>PRN(s): </td>
                <td>
                  <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                    {Object.keys(satelliteData).map(prn => (
                      <div key={`label-${prn}`} style={{ width: '39px', textAlign: 'center' }}>
                        {prn}
                      </div>
                    ))}
                  </div>
                </td>
              </tr>
              <tr>
                <td>{satelliteSystem}: (All) <input type="checkbox" checked={allChecked} onChange={toggleAllPrns} /></td>
                <td>
                  <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                    {Object.keys(satelliteData).map(prn => (
                      <div key={`cb-${prn}`} style={{ width: '39px', textAlign: 'center' }}>
                        <input type="checkbox" checked={prnChecked[prn] !== false} onChange={() => togglePrn(prn)}/>
                      </div>
                    ))}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
          {/* Chart */}
          <Line options={options} data={chartData()} />
        </div>

        <div style={{ flex: 2, minWidth: 0, overflow: 'hidden' }}>

          <table border="1" style={{ width: '100%', boxSizing: 'border-box', tableLayout: 'fixed' }} cellPadding="5" cellSpacing="0">
            <thead>
              <tr>
                <th style={{ width: '10%' }}>No.</th>
                <th style={{ width: '90%' }}><div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap' }}>Data <input id="raw-file-date" type="date" value={rawFileDate} onChange={e => {setRawFileDate(e.target.value); setRawFilePage(1); }}/>
            <button type="button" onClick={() => {setRawFileDate(''); setRawFilePage(1);}}>Clear</button></div></th>
              </tr>
            </thead>
            <tbody>
              {files.length === 0 && (
                <tr>
                  <td colSpan={2} style={{ textAlign: 'center', padding: '10px' }}>No raw files found</td>
                </tr>
              )}
              {files.map((file, index) => (
                <tr key={file.path}>
                  <td style={{ overflow: 'hidden' }}>{index + 1}</td>
                  <td style={{ overflow: 'hidden', padding: '5px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                      <div
                        title={file.name}
                        style={{
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          flex: 1,
                          minWidth: 0,
                        }}
                      >
                        {file.name}
                      </div>
                      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={() => handleLoadFileData(file.name)}
                          disabled={selectedXAxis !== 'static' || isFileLoading}
                          style={{
                            padding: '4px 8px',
                            background: selectedRawFileName === file.name ? '#2e7d32' : '#455a64',
                            color: 'white',
                            border: 'none',
                            borderRadius: '3px',
                            whiteSpace: 'nowrap',
                            cursor: selectedXAxis === 'static' && !isFileLoading ? 'pointer' : 'not-allowed',
                            opacity: selectedXAxis === 'static' ? 1 : 0.6,
                          }}
                        >
                          {isFileLoading && selectedRawFileName === file.name ? 'Loading...' : 'View'}
                        </button>
                        <a
                          href={file.path.startsWith('/') ? `${BACKEND_HTTP}${file.path}` : file.path}
                          target="_blank"
                          rel="noreferrer"
                          style={{ padding: '4px 8px', background: '#1976d2', color: 'white', textDecoration: 'none', borderRadius: '3px', whiteSpace: 'nowrap' }}
                        >
                          Download
                        </a>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', gap: '8px', flexWrap: 'wrap' }}>
            <div>
              Total: <strong>{rawFileTotal}</strong>
              {selectedXAxis === 'static' && selectedRawFileName && (
                <span> | Viewing: <strong>{selectedRawFileName}</strong></span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setRawFilePage(prev => Math.max(prev - 1, 1))}
                disabled={rawFilePage <= 1}
              >
                Prev
              </button>
              <span>
                Page {rawFilePage} / {rawFileTotalPages}
              </span>
              <button
                type="button"
                onClick={() => setRawFilePage(prev => Math.min(prev + 1, rawFileTotalPages))}
                disabled={rawFilePage >= rawFileTotalPages}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </div >
  );
}

export default TelemetryCharts;
