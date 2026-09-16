<?php

use App\Http\Controllers\MonitoraController;
use Illuminate\Support\Facades\Route;

Route::get('/', [MonitoraController::class, 'dashboard']);
Route::get('/index.html', [MonitoraController::class, 'dashboard']);
Route::get('/analises', [MonitoraController::class, 'analyses']);
Route::get('/analises.html', [MonitoraController::class, 'analyses']);
Route::get('/auth/callback', [MonitoraController::class, 'callback']);
Route::get('/auth/callback.html', [MonitoraController::class, 'callback']);
