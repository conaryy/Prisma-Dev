<?php

namespace Tests\Feature;

// use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ExampleTest extends TestCase
{
    public function test_application_bootstraps_in_testing_environment(): void
    {
        $this->assertTrue(app()->environment('testing'));
    }
}
