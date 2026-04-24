/**
 * Provider-specific API response types kept at this shared path for import compatibility.
 */

export interface PlaudDevice {
    sn: string;
    name: string;
    model: string;
    version_number: number;
}

export interface PlaudDeviceListResponse {
    status: number;
    msg: string;
    data_devices: PlaudDevice[];
}

export interface PlaudRecording {
    id: string;
    filename: string;
    keywords: string[];
    filesize: number;
    filetype: string;
    fullname: string;
    file_md5: string;
    ori_ready: boolean;
    version: number;
    version_ms: number;
    edit_time: number;
    edit_from: string;
    is_trash: boolean;
    start_time: number; // Unix timestamp in milliseconds
    end_time: number; // Unix timestamp in milliseconds
    duration: number; // Duration in milliseconds
    timezone: number;
    zonemins: number;
    scene: number;
    filetag_id_list: string[];
    serial_number: string;
    is_trans: boolean;
    is_summary: boolean;
}

export interface PlaudRecordingsResponse {
    status: number;
    msg: string;
    data_file_total: number;
    data_file_list: PlaudRecording[];
}

export interface PlaudTempUrlResponse {
    status: number;
    temp_url: string;
    temp_url_opus?: string;
}

export interface PlaudApiError {
    status: number;
    msg: string;
}

export interface PlaudContentListItem {
    data_id: string;
    data_type:
        | "transaction"
        | "outline"
        | "transaction_polish"
        | "auto_sum_note"
        | string;
    task_status: number;
    err_code: string;
    err_msg: string;
    data_title: string;
    data_tab_name: string;
    data_link: string;
}

/** A single segment from Plaud's stored transcription (trans_result field). */
export interface PlaudTranscriptSegment {
    speaker: string;
    content: string;
    start_time: number; // milliseconds from start of recording
    end_time: number; // milliseconds from start of recording
}

/** Response from POST /file/list — returns full file detail including trans_result. */
export interface PlaudFileListResponse {
    status: number;
    msg: string;
    data_file_list: Array<{
        id: string;
        trans_result?: PlaudTranscriptSegment[];
    }>;
}

export interface PlaudFileDetailData {
    file_id: string;
    file_name: string;
    file_version: number;
    duration: number;
    is_trash: boolean;
    start_time: number;
    scene: number;
    serial_number: string;
    session_id: number;
    filetag_id_list: string[];
    content_list: PlaudContentListItem[];
    embeddings?: Record<string, unknown>;
    download_path_mapping?: Record<string, string>;
    pre_download_content_list?: unknown[];
    extra_data?: unknown;
    has_thought_partner?: boolean;
}

export interface PlaudFileDetailResponse {
    status: number;
    msg: string;
    request_id?: string;
    data: PlaudFileDetailData;
}

export interface PlaudOutlineItem {
    start_time: number;
    end_time: number;
    topic: string;
}

export interface PlaudSummaryContent {
    content?:
        | {
              markdown?: string;
              [key: string]: unknown;
          }
        | string;
}

export interface PlaudTranssummResponse {
    status: number;
    msg: string;
    request_id?: string;
    data_result: PlaudTranscriptSegment[] | null;
    data_result_summ: PlaudSummaryContent | string | null;
    data_result_summ_mul: unknown;
    outline_result: PlaudOutlineItem[] | null;
    outline_task_status?: number;
    task_id_info?: unknown;
    data_source_result?: unknown;
    data_note_result?: unknown;
    download_link_map?: Record<string, string>;
    file_version?: number;
    auto_save?: unknown;
    ppc_status?: number;
    err_code?: string;
    err_msg?: string;
}
