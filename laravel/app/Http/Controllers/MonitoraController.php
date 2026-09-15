<?php

namespace App\Http\Controllers;

use Illuminate\Http\Response;

class MonitoraController extends Controller
{
    public function dashboard(): Response
    {
        return $this->page('index.html');
    }

    public function analyses(): Response
    {
        return $this->page('analises.html');
    }

    public function callback(): Response
    {
        return $this->page('auth/callback.html');
    }

    private function page(string $file): Response
    {
        // Apenas nomes definidos no código chegam aqui; nunca caminhos da URL.
        $path = resource_path('frontend/'.$file);
        abort_unless(is_file($path), 503, 'MONITORA indisponível.');

        return response(file_get_contents($path), 200, [
            'Content-Type' => 'text/html; charset=UTF-8',
            'Cache-Control' => 'no-store, max-age=0',
            'Pragma' => 'no-cache',
        ]);
    }
}
